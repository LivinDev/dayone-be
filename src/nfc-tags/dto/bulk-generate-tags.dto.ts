import { IsInt, Max, Min } from 'class-validator';

export class BulkGenerateTagsDto {
  // Capped well above a real batch size (20-50 shirts) — high enough to
  // cover a season's worth of restocks in one go, low enough that a typo
  // (e.g. an extra zero) can't accidentally mint thousands of unused codes.
  @IsInt()
  @Min(1)
  @Max(500)
  count: number;
}
