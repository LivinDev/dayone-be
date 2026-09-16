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

// A moment within a day — a short optional label plus its own ordered,
// individually-captioned images. Used both nested inside CreateTimelineEntryDto
// (a day's first section(s)) and standalone for POST .../sections.
export class SectionInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A section needs at least one image' })
  @ArrayMaxSize(6, { message: 'A section can have at most 6 images' })
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  images: ImageInputDto[];
}
