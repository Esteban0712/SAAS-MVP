import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  PaymentStatus,
  ReceiptStatus,
  SaleItemType,
  SaleStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { SaleItemDto } from './dto/sale-item.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

const detailInclude = {
  branch: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  employee: { select: { id: true, displayName: true } },
  appointment: { select: { id: true, startAt: true, status: true } },
  items: { orderBy: { id: 'asc' as const } },
  payments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  receipt: true,
} satisfies Prisma.SaleInclude;

interface CalculatedItem {
  serviceId?: string | null;
  type: SaleItemType;
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  total: Prisma.Decimal;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, query: ListSalesQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.SaleWhereInput = {
      businessId,
      status: query.status,
      customerId: query.customerId,
      ...(search
        ? {
            OR: [
              { notes: { contains: search, mode: 'insensitive' } },
              {
                customer: {
                  is: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { phone: { contains: search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: detailInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.serializeSale(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total ? Math.ceil(total / query.pageSize) : 0,
    };
  }

  async findOne(businessId: string, id: string) {
    const row = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: detailInclude,
    });
    if (!row) throw new NotFoundException();
    return this.serializeSale(row);
  }

  create(businessId: string, userId: string, input: CreateSaleDto) {
    return this.prisma.$transaction(
      async (tx) => {
        let branchId = input.branchId,
          customerId = input.customerId,
          employeeId = input.employeeId;
        let sourceItems = input.items;
        if (input.appointmentId) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "Appointment" WHERE id = ${input.appointmentId}::uuid AND "businessId" = ${businessId}::uuid FOR UPDATE`,
          );
          const appointment = await tx.appointment.findFirst({
            where: { id: input.appointmentId, businessId },
            include: { services: true },
          });
          if (!appointment) throw new NotFoundException();
          const duplicate = await tx.sale.findFirst({
            where: {
              appointmentId: input.appointmentId,
              businessId,
              status: { not: SaleStatus.CANCELLED },
            },
            select: { id: true },
          });
          if (duplicate)
            throw new ConflictException(
              'Appointment already has an active sale',
            );
          branchId = appointment.branchId;
          customerId = appointment.customerId;
          employeeId = appointment.employeeId;
          sourceItems = appointment.services.map((item) => ({
            type: SaleItemType.SERVICE,
            serviceId: item.serviceId,
            description: item.serviceNameSnapshot,
            quantity: 1,
            unitPrice: item.priceSnapshot.toFixed(2),
          }));
        }
        if (!branchId || !sourceItems?.length)
          throw new BadRequestException('Branch and items are required');
        await this.assertRelations(
          tx,
          businessId,
          branchId,
          customerId,
          employeeId,
        );
        const items = await this.items(tx, businessId, sourceItems);
        const totals = this.totals(items, input.discountTotal, input.taxTotal);
        const row = await tx.sale.create({
          data: {
            businessId,
            branchId,
            customerId,
            appointmentId: input.appointmentId,
            employeeId,
            createdByUserId: userId,
            ...totals,
            notes: this.optional(input.notes),
            items: { create: items },
          },
          include: detailInclude,
        });
        return this.serializeSale(row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  update(businessId: string, id: string, input: UpdateSaleDto) {
    if (!Object.keys(input).length)
      throw new BadRequestException('At least one field is required');
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, businessId, id);
      const current = await tx.sale.findFirst({
        where: { id, businessId },
        include: { items: true },
      });
      if (!current) throw new NotFoundException();
      if (current.status !== SaleStatus.DRAFT)
        throw new ConflictException('Only draft sales can be edited');
      const branchId = input.branchId ?? current.branchId,
        customerId = input.customerId ?? current.customerId,
        employeeId = input.employeeId ?? current.employeeId;
      await this.assertRelations(
        tx,
        businessId,
        branchId,
        customerId ?? undefined,
        employeeId ?? undefined,
      );
      const items: CalculatedItem[] = input.items
        ? await this.items(tx, businessId, input.items)
        : current.items.map((item) => ({
            serviceId: item.serviceId,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          }));
      const totals = this.totals(
        items,
        input.discountTotal ?? current.discountTotal.toFixed(2),
        input.taxTotal ?? current.taxTotal.toFixed(2),
      );
      if (input.items) {
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.saleItem.createMany({
          data: items.map((item): Prisma.SaleItemCreateManyInput => ({
            saleId: id,
            serviceId: item.serviceId,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        });
      }
      const row = await tx.sale.update({
        where: { id, businessId },
        data: {
          branchId: input.branchId,
          customerId: input.customerId,
          employeeId: input.employeeId,
          status: input.status,
          notes:
            input.notes !== undefined ? this.optional(input.notes) : undefined,
          ...totals,
        },
        include: detailInclude,
      });
      return this.serializeSale(row);
    });
  }

  async payments(businessId: string, id: string) {
    await this.assertSale(businessId, id);
    const rows = await this.prisma.payment.findMany({
      where: { saleId: id, sale: { businessId } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.serializePayment(row));
  }

  async addPayment(
    businessId: string,
    userId: string,
    id: string,
    input: CreatePaymentDto,
  ) {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0))
      throw new BadRequestException('Payment amount must be positive');
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, businessId, id);
      const sale = await tx.sale.findFirst({
        where: { id, businessId },
        select: { id: true, status: true, total: true },
      });
      if (!sale) throw new NotFoundException();
      if (
        sale.status !== SaleStatus.PENDING_PAYMENT &&
        sale.status !== SaleStatus.PAID
      )
        throw new ConflictException('Sale does not accept payments');
      const status = input.status ?? PaymentStatus.COMPLETED;
      const aggregate = await tx.payment.aggregate({
        where: { saleId: id, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      });
      const previouslyPaid = aggregate._sum.amount ?? new Prisma.Decimal(0);
      if (
        status === PaymentStatus.COMPLETED &&
        previouslyPaid.plus(amount).gt(sale.total)
      ) {
        throw new ConflictException('Payment exceeds outstanding balance');
      }
      const payment = await tx.payment.create({
        data: {
          saleId: id,
          createdByUserId: userId,
          method: input.method,
          amount,
          status,
          externalReference: this.optional(input.externalReference),
          paidAt: status === PaymentStatus.COMPLETED ? new Date() : null,
        },
      });
      const amountPaid =
        status === PaymentStatus.COMPLETED
          ? previouslyPaid.plus(amount)
          : previouslyPaid;
      if (amountPaid.gte(sale.total) && sale.status !== SaleStatus.PAID)
        await tx.sale.update({
          where: { id, businessId },
          data: { status: SaleStatus.PAID },
        });
      return {
        payment: this.serializePayment(payment),
        amountPaid: amountPaid.toFixed(2),
        balanceDue: Prisma.Decimal.max(sale.total.minus(amountPaid), 0).toFixed(
          2,
        ),
        saleStatus: amountPaid.gte(sale.total) ? SaleStatus.PAID : sale.status,
      };
    });
  }

  async receipt(businessId: string, id: string) {
    await this.assertSale(businessId, id);
    const row = await this.prisma.receipt.findFirst({
      where: { saleId: id, businessId },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async generateReceipt(businessId: string, id: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.lockSale(tx, businessId, id);
          const existing = await tx.receipt.findFirst({
            where: { saleId: id, businessId },
          });
          if (existing) return existing;
          const sale = await tx.sale.findFirst({
            where: { id, businessId },
            include: detailInclude,
          });
          if (!sale) throw new NotFoundException();
          if (sale.status !== SaleStatus.PAID)
            throw new ConflictException('Only paid sales can have a receipt');
          const serialized = this.serializeSale(sale);
          const receiptNumber = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
          return tx.receipt.create({
            data: {
              businessId,
              saleId: id,
              receiptNumber,
              status: ReceiptStatus.GENERATED,
              generatedAt: new Date(),
              dataJson: JSON.parse(
                JSON.stringify(serialized),
              ) as Prisma.InputJsonValue,
            },
          });
        });
      } catch (error) {
        if (attempt < 2 && this.isUnique(error)) continue;
        throw error;
      }
    }
    throw new ConflictException('Could not allocate receipt number');
  }

  private async items(
    tx: Prisma.TransactionClient,
    businessId: string,
    input: SaleItemDto[],
  ): Promise<CalculatedItem[]> {
    const serviceIds = [
      ...new Set(
        input.flatMap((item) => (item.serviceId ? [item.serviceId] : [])),
      ),
    ];
    if (serviceIds.length) {
      const count = await tx.service.count({
        where: { id: { in: serviceIds }, businessId },
      });
      if (count !== serviceIds.length) throw new NotFoundException();
    }
    return input.map((item) => {
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return {
        serviceId: item.serviceId,
        type: item.type,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice,
        total: unitPrice.mul(item.quantity),
      };
    });
  }
  private totals(
    items: Array<{ total: Prisma.Decimal }>,
    discount = '0',
    tax = '0',
  ) {
    const subtotal = items.reduce(
      (sum, item) => sum.plus(item.total),
      new Prisma.Decimal(0),
    );
    const discountTotal = new Prisma.Decimal(discount);
    const taxTotal = new Prisma.Decimal(tax);
    const total = subtotal.minus(discountTotal).plus(taxTotal);
    if (discountTotal.gt(subtotal) || total.lt(0))
      throw new BadRequestException('Invalid totals');
    return { subtotal, discountTotal, taxTotal, total };
  }
  private async assertRelations(
    tx: Prisma.TransactionClient,
    businessId: string,
    branchId: string,
    customerId?: string,
    employeeId?: string,
  ) {
    const [branch, customer, employee] = await Promise.all([
      tx.branch.findFirst({
        where: { id: branchId, businessId },
        select: { id: true },
      }),
      customerId
        ? tx.customer.findFirst({
            where: { id: customerId, businessId },
            select: { id: true },
          })
        : true,
      employeeId
        ? tx.employee.findFirst({
            where: { id: employeeId, businessId, branchId },
            select: { id: true },
          })
        : true,
    ]);
    if (!branch || !customer || !employee) throw new NotFoundException();
  }
  private async assertSale(businessId: string, id: string) {
    if (
      !(await this.prisma.sale.findFirst({
        where: { id, businessId },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
  }
  private async lockSale(
    tx: Prisma.TransactionClient,
    businessId: string,
    id: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM "Sale" WHERE id = ${id}::uuid AND "businessId" = ${businessId}::uuid FOR UPDATE`,
    );
    if (!rows[0]) throw new NotFoundException();
  }
  private serializePayment<
    T extends { amount: { toFixed(digits: number): string } },
  >(row: T) {
    return { ...row, amount: row.amount.toFixed(2) };
  }
  private serializeSale<
    T extends {
      subtotal: Prisma.Decimal;
      discountTotal: Prisma.Decimal;
      taxTotal: Prisma.Decimal;
      total: Prisma.Decimal;
      items: Array<{ unitPrice: Prisma.Decimal; total: Prisma.Decimal }>;
      payments: Array<{ amount: Prisma.Decimal; status: PaymentStatus }>;
    },
  >(row: T) {
    const amountPaid = row.payments
      .filter((payment) => payment.status === PaymentStatus.COMPLETED)
      .reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
    return {
      ...row,
      subtotal: row.subtotal.toFixed(2),
      discountTotal: row.discountTotal.toFixed(2),
      taxTotal: row.taxTotal.toFixed(2),
      total: row.total.toFixed(2),
      items: row.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toFixed(2),
        total: item.total.toFixed(2),
      })),
      payments: row.payments.map((payment) => this.serializePayment(payment)),
      amountPaid: amountPaid.toFixed(2),
      balanceDue: Prisma.Decimal.max(row.total.minus(amountPaid), 0).toFixed(2),
    };
  }
  private optional(value?: string) {
    return value?.trim() || null;
  }
  private isUnique(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
