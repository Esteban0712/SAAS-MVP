import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import type { AuthenticatedPrincipal, AuthTokenPayload } from './auth.types';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { TenantLoginDto } from './dto/tenant-login.dto';

const INVALID_CREDENTIALS = 'Invalid credentials';

@Injectable()
export class AuthService {
  private readonly expiresIn: JwtSignOptions['expiresIn'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    configService: ConfigService,
  ) {
    this.expiresIn = configService.get<string>(
      'JWT_EXPIRES_IN',
      '8h',
    ) as JwtSignOptions['expiresIn'];
  }

  async loginTenant(
    input: TenantLoginDto,
  ): Promise<{ token: string; principal: AuthenticatedPrincipal }> {
    const user = await this.prisma.user.findFirst({
      where: {
        username: input.username,
        business: { slug: input.businessSlug },
      },
      include: {
        business: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const passwordMatches = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : false;

    if (
      !user ||
      !passwordMatches ||
      user.status !== 'ACTIVE' ||
      user.business.status !== 'ACTIVE' ||
      !user.role.active
    ) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const principal = this.toTenantPrincipal(user);
    return {
      principal,
      token: await this.sign({
        sub: user.id,
        actorType: 'USER',
        businessId: user.businessId,
      }),
    };
  }

  async loginPlatform(
    input: PlatformLoginDto,
  ): Promise<{ token: string; principal: AuthenticatedPrincipal }> {
    const user = await this.prisma.platformUser.findUnique({
      where: { username: input.username },
    });
    const passwordMatches = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : false;

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return {
      principal: {
        actorType: 'PLATFORM',
        platformUserId: user.id,
        username: user.username,
      },
      token: await this.sign({ sub: user.id, actorType: 'PLATFORM' }),
    };
  }

  async resolvePrincipal(
    payload: AuthTokenPayload,
  ): Promise<AuthenticatedPrincipal> {
    if (payload.actorType === 'PLATFORM') {
      const user = await this.prisma.platformUser.findUnique({
        where: { id: payload.sub },
      });
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException();
      }
      return {
        actorType: 'PLATFORM',
        platformUserId: user.id,
        username: user.username,
      };
    }

    if (payload.actorType !== 'USER' || !payload.businessId) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        business: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (
      !user ||
      user.businessId !== payload.businessId ||
      user.status !== 'ACTIVE' ||
      user.business.status !== 'ACTIVE' ||
      !user.role.active
    ) {
      throw new UnauthorizedException();
    }

    return this.toTenantPrincipal(user);
  }

  private sign(payload: AuthTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, { expiresIn: this.expiresIn });
  }

  private toTenantPrincipal(user: {
    id: string;
    businessId: string;
    roleId: string;
    username: string;
    displayName: string | null;
    role: {
      permissions: Array<{ permission: { code: string } }>;
    };
  }): AuthenticatedPrincipal {
    return {
      actorType: 'USER',
      userId: user.id,
      businessId: user.businessId,
      roleId: user.roleId,
      username: user.username,
      displayName: user.displayName,
      permissions: user.role.permissions.map(
        ({ permission }) => permission.code,
      ),
    };
  }
}
