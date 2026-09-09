import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

// Not `PartialType(CreateProductDto)` — this project hand-writes its DTOs
// (see SignupDto/CreateStaffDto) rather than pulling in @nestjs/mapped-types
// for one module.
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case, e.g. "heavyweight-tee-black"',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

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
  @Min(1)
  gsm?: number;

  @IsOptional()
  @IsString()
  fit?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'A product can have at most 5 images' })
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
