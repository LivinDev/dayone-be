import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// Hand-written, not PartialType(CreateAddressDto) — matches this project's
// existing DTO style (see products/, users/ dto's).
export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  state?: string;

  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit Indian PIN code' })
  pincode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
