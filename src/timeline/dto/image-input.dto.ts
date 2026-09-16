import { IsOptional, IsString, MaxLength } from 'class-validator';

// One image within a TimelineSection — the actual new capability this
// round adds is `caption` living here, not on the section or the day.
export class ImageInputDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  caption?: string;
}
