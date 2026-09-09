import { IsString, Matches, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  // kebab-case, used in the public Collection URL (?category=<slug>) — not
  // auto-derived from `name` server-side, same deliberate-field stance as
  // Product.slug.
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case, e.g. "date-night"',
  })
  slug: string;
}
