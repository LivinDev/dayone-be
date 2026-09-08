import { IsBoolean, IsString, MinLength } from 'class-validator';
import { TrimmedEmail } from '../../common/decorators/trimmed-email.decorator';

// Field shape matches dayone-web's signup-form.tsx exactly (fullName/email/password/
// confirmPassword/updates) so the frontend doesn't need reshaping. `updates` (newsletter
// opt-in) isn't persisted anywhere yet — no newsletter feature/field exists in the schema.
export class SignupDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @TrimmedEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  confirmPassword: string;

  @IsBoolean()
  updates: boolean;
}
