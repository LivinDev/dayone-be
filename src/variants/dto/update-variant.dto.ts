import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  size?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceInPaise?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  mrpInPaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'A variant can have at most 5 images' })
  @IsString({ each: true })
  images?: string[];
}
