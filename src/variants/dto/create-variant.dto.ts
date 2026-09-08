import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVariantDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsString()
  @MinLength(1)
  size: string;

  @IsString()
  @MinLength(1)
  sku: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceInPaise?: number;

  @IsInt()
  @Min(0)
  stockQuantity: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'A variant can have at most 5 images' })
  @IsString({ each: true })
  images?: string[];
}
