import { IsString, MinLength } from 'class-validator';
import { TrimmedEmail } from '../../common/decorators/trimmed-email.decorator';

export class LoginDto {
  @TrimmedEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
