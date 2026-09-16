import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTimelineEntryDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one image' })
  @ArrayMaxSize(6, { message: 'An entry can have at most 6 images' })
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  @IsString()
  @MaxLength(280)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  // Optional — defaults to now() at the DB layer if omitted, so the form
  // doesn't need a date picker to be usable.
  @IsOptional()
  @IsDateString()
  entryDate?: string;
}
