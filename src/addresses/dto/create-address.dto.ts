import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  phone: string;

  @IsString()
  @MinLength(1)
  line1: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @MinLength(1)
  state: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit Indian PIN code' })
  pincode: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
