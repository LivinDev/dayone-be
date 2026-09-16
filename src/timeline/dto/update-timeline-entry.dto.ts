import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EntryOccasion } from '@prisma/client';

// Day-level fields only — sections/images are managed through their own
// endpoints (POST .../sections, PATCH /timeline/sections/:id), not here.
export class UpdateTimelineEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsOptional()
  @IsIn(Object.values(EntryOccasion))
  occasion?: EntryOccasion;
}
