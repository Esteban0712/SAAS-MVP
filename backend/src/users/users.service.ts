import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  businessId: true,
  roleId: true,
  username: true,
  status: true,
  mustChangePassword: true,
  isOwner: true,
  email: true,
  phone: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  list(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId },
      select: userSelect,
      orderBy: { username: 'asc' },
    });
  }

  async create(businessId: string, input: CreateUserDto) {
    await this.assertRole(businessId, input.roleId);
    await this.assertUsernameAvailable(businessId, input.username);

    return this.prisma.user.create({
      data: {
        businessId,
        roleId: input.roleId,
        username: input.username,
        passwordHash: await this.passwords.hash(input.password),
        status: input.status,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
      },
      select: userSelect,
    });
  }

  async findOne(businessId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, businessId },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }

  async update(
    principal: AuthenticatedPrincipal,
    id: string,
    input: UpdateUserDto,
  ) {
    if (principal.actorType !== 'USER') {
      throw new NotFoundException();
    }
    await this.findOne(principal.businessId, id);

    if (
      id === principal.userId &&
      (input.roleId !== undefined || input.status !== undefined)
    ) {
      throw new ForbiddenException('Cannot change your own role or status');
    }
    if (input.roleId) {
      await this.assertRole(principal.businessId, input.roleId);
    }
    if (input.username) {
      await this.assertUsernameAvailable(
        principal.businessId,
        input.username,
        id,
      );
    }

    return this.prisma.user.update({
      where: { id, businessId: principal.businessId },
      data: input,
      select: userSelect,
    });
  }

  private async assertRole(businessId: string, roleId: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, businessId, active: true },
      select: { id: true },
    });
    if (!role) {
      throw new BadRequestException('Invalid roleId');
    }
  }

  private async assertUsernameAvailable(
    businessId: string,
    username: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        businessId,
        username,
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Username already exists');
    }
  }
}
