import { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { LoginRateLimitService } from './login-rate-limit.service';

describe('LoginRateLimitGuard', () => {
  it('returns 429 with Retry-After after the bucket is exhausted', () => {
    const limiter = { consume: jest.fn().mockReturnValue(12) };
    const setHeader = jest.fn();
    const request = { ip: '127.0.0.1', path: '/auth/login' } as Request;
    const response = { setHeader } as unknown as Response;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    expect(() =>
      new LoginRateLimitGuard(
        limiter as unknown as LoginRateLimitService,
      ).canActivate(context),
    ).toThrow('Too many login attempts');
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '12');
  });
});
