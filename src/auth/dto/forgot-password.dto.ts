import { TrimmedEmail } from '../../common/decorators/trimmed-email.decorator';

export class ForgotPasswordDto {
  @TrimmedEmail()
  email: string;
}
