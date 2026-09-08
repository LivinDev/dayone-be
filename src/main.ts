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
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
