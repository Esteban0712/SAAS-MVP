import type { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  it('sets minimum API security headers without an improvised CSP', () => {
    const setHeader = jest.fn();
    const removeHeader = jest.fn();
    const response = {
      setHeader,
      removeHeader,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    const config = { get: jest.fn().mockReturnValue('production') };
    new SecurityHeadersMiddleware(config as unknown as ConfigService).use(
      {} as Request,
      response,
      next,
    );

    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).not.toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.anything(),
    );
    expect(removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
