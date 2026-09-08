import { IsIn, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { TrimmedEmail } from '../../common/decorators/trimmed-email.decorator';

// Admin-only. CUSTOMER is deliberately excluded — customers can only ever be
// created through the public /auth/signup flow, never through this endpoint.
export class CreateStaffDto {
  @TrimmedEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsIn([Role.MANAGER, Role.ADMIN])
  role: Role;
}
