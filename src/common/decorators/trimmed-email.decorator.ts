import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

// Trims before @IsEmail() runs, so a pasted email with a stray leading/trailing
// space fails as "not a valid account" (or just works) rather than a confusing
// "email must be an email" 400.
export function TrimmedEmail() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsEmail(),
  );
}
