import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EntryOccasion } from '@prisma/client';
import { SectionInputDto } from './section-input.dto';

// A "day" — location/occasion/date describe the day itself; the actual
// content is its sections (each a captioned group of images). At least one
// section is required to create a day at all.
export class CreateTimelineEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  // Optional — defaults to now() at the DB layer if omitted, so the form
  // doesn't need a date picker to be usable.
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsOptional()
  @IsIn(Object.values(EntryOccasion))
  occasion?: EntryOccasion;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one section' })
  @ValidateNested({ each: true })
  @Type(() => SectionInputDto)
  sections: SectionInputDto[];
}
