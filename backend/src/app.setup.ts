import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export function configureApplication(
  app: INestApplication,
  configService: ConfigService,
): void {
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({ origin: frontendUrl, credentials: true });
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
