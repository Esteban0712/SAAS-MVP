import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const roleInclude = {
  permissions: {
    include: { permission: true },
    orderBy: { permission: { code: 'asc' as const } },
  },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string) {
    const roles = await this.prisma.role.findMany({
      where: { businessId },
      include: roleInclude,
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => this.toResponse(role));
  }

  async create(businessId: string, input: CreateRoleDto) {
    await this.assertNameAvailable(businessId, input.name);
    await this.assertPermissions(input.permissionIds);

    const role = await this.prisma.role.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        active: input.active,
        permissions: {
          createMany: {
            data: input.permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
      },
      include: roleInclude,
    });
    return this.toResponse(role);
  }

  async findOne(businessId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, businessId },
      include: roleInclude,
    });
    if (!role) {
      throw new NotFoundException();
    }
    return this.toResponse(role);
  }

  async update(
    principal: AuthenticatedPrincipal,
    id: string,
    input: UpdateRoleDto,
  ) {
    if (principal.actorType !== 'USER') {
      throw new NotFoundException();
    }
    await this.findOne(principal.businessId, id);

    if (
      id === principal.roleId &&
      (input.permissionIds !== undefined || input.active === false)
    ) {
      throw new ForbiddenException(
        'Cannot change permissions or deactivate your own role',
      );
    }
    if (input.name) {
      await this.assertNameAvailable(principal.businessId, input.name, id);
    }
    if (input.permissionIds) {
      await this.assertPermissions(input.permissionIds);
    }

    const { permissionIds, ...roleData } = input;
    const role = await this.prisma.$transaction(async (transaction) => {
      await transaction.role.update({
        where: { id, businessId: principal.businessId },
        data: roleData,
      });
      if (permissionIds !== undefined) {
        await transaction.rolePermission.deleteMany({
          where: { roleId: id, role: { businessId: principal.businessId } },
        });
        if (permissionIds.length) {
          await transaction.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }
      return transaction.role.findFirstOrThrow({
        where: { id, businessId: principal.businessId },
        include: roleInclude,
      });
    });
    return this.toResponse(role);
  }

  private async assertPermissions(permissionIds: string[]): Promise<void> {
    const count = await this.prisma.permission.count({
      where: { id: { in: permissionIds } },
    });
    if (count !== permissionIds.length) {
      throw new BadRequestException('Invalid permissionIds');
    }
  }

  private async assertNameAvailable(
    businessId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.prisma.role.findFirst({
      where: { businessId, name, id: exceptId ? { not: exceptId } : undefined },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Role name already exists');
    }
  }

  private toResponse<
    T extends {
      permissions: Array<{ permission: unknown }>;
    },
  >(role: T) {
    const { permissions, ...data } = role;
    return {
      ...data,
      permissions: permissions.map(({ permission }) => permission),
    };
  }
}
