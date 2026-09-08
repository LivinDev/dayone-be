import { IsOptional, IsString, MinLength } from 'class-validator';

// Self-service profile edit (PATCH /users/me). Deliberately excludes email
// and role — email changes would need re-verification (not built), and role
// can only ever change through admin-only staff endpoints.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
