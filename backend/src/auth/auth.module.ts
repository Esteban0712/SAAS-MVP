import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PermissionsGuard } from './permissions.guard';
import { PlatformGuard } from './platform.guard';
import { PlatformAuthController } from './platform-auth.controller';
import { TenantGuard } from './tenant.guard';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { LoginRateLimitService } from './login-rate-limit.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController, PlatformAuthController],
  providers: [
    AuthService,
    PasswordService,
    AuthCookieService,
    AuthGuard,
    TenantGuard,
    PlatformGuard,
    PermissionsGuard,
    LoginRateLimitService,
    LoginRateLimitGuard,
  ],
  exports: [
    JwtModule,
    AuthService,
    AuthCookieService,
    PasswordService,
    AuthGuard,
    TenantGuard,
    PlatformGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
