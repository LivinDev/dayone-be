import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

process.loadEnvFile('.env');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // whitelist strips any request-body property not declared on the DTO — this is
  // what stops a signup request from smuggling in e.g. `role: "ADMIN"`. transform
  // is needed for DTOs' @Transform() decorators (e.g. trimming email) to actually
  // apply to the value the controller receives, not just during validation.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // FRONTEND_ORIGIN is the one canonical storefront URL (also used by the
  // /t/:code and /claim/:code redirect targets — see tap-redirect.controller.ts).
  // CORS_EXTRA_ORIGINS is optional and additive, for origins that should be
  // allowed to call this API without being the redirect target themselves —
  // e.g. a local frontend dev server pointed at the deployed backend.
  const extraOrigins = (process.env.CORS_EXTRA_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [process.env.FRONTEND_ORIGIN, ...extraOrigins].filter(Boolean),
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
