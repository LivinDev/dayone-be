import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ImageInputDto } from './image-input.dto';

// Images, if provided, replace the section's full list (add/remove/reorder
// by resubmitting the whole array) — same "submit the full current
// selection" convention already used for Product.images/categories.
export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'A section needs at least one image' })
  @ArrayMaxSize(6, { message: 'A section can have at most 6 images' })
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  images?: ImageInputDto[];
}
