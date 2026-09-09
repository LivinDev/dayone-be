import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

// Not `PartialType(CreateCategoryDto)` — this project hand-writes its DTOs
// (see SignupDto/CreateStaffDto/CreateProductDto) rather than pulling in
// @nestjs/mapped-types for one module.
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case, e.g. "date-night"',
  })
  slug?: string;
}
