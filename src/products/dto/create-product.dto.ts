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

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  // kebab-case, used in the public product URL — not auto-derived from
  // `name` so the founder can set/change it deliberately.
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case, e.g. "heavyweight-tee-black"',
  })
  slug: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsInt()
  @Min(1)
  priceInPaise: number;

  // Optional "was" price — validated against priceInPaise at the service
  // layer (mrp must be >= the selling price), not here, since that's a
  // cross-field check.
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

  // Category ids to connect — validated as real Categories at the service
  // layer (a bad id 404s via the FK constraint / an explicit lookup), not
  // an enum anymore now that categories are admin-manageable.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
