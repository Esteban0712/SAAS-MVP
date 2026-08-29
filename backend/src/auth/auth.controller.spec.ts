import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthenticatedPrincipal } from './auth.types';

describe('AuthController and auth cookie', () => {
  const principal: AuthenticatedPrincipal = {
    actorType: 'USER',
    userId: 'user-a',
    businessId: 'business-a',
    roleId: 'role-a',
    username: 'admin',
    displayName: 'Admin A',
    permissions: ['dashboard.view'],
  };
  const auth = {
    loginTenant: jest.fn().mockResolvedValue({
      principal,
      token: 'signed-jwt',
    }),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'NODE_ENV') return 'development';
      return fallback;
    }),
  };
  const cookies = new AuthCookieService(config as unknown as ConfigService);
  const controller = new AuthController(
    auth as unknown as AuthService,
    cookies,
  );
  const responseCookie = jest.fn();
  const responseClearCookie = jest.fn();
  const response = {
    cookie: responseCookie,
    clearCookie: responseClearCookie,
  } as unknown as Response;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets the JWT in an HttpOnly eight-hour cookie after login', async () => {
    await expect(
      controller.login(
        {
          businessSlug: 'demo-business-a',
          username: 'admin',
          password: 'development-password',
        },
        response,
      ),
    ).resolves.toEqual(principal);

    expect(responseCookie).toHaveBeenCalledWith(
      'deenova_session',
      'signed-jwt',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/api',
        maxAge: 28_800_000,
      },
    );
  });

  it('returns the authenticated principal from me', () => {
    expect(controller.me(principal)).toEqual(principal);
  });

  it('clears the session cookie on logout', () => {
    controller.logout(response);
    expect(responseClearCookie).toHaveBeenCalledWith('deenova_session', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api',
    });
  });
});
