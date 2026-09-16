import { IsIn, IsOptional } from 'class-validator';
import { DestinationKind, StoryTheme } from '@prisma/client';

// The owner's choice right after claiming (or changeable later): a plain
// link, or a hosted Story page. `theme` only matters when kind is STORY —
// defaults to SUNSET_BLOOM at the service layer if omitted.
export class UpdateDestinationKindDto {
  @IsIn([DestinationKind.LINK, DestinationKind.STORY])
  kind: DestinationKind;

  @IsOptional()
  @IsIn([
    StoryTheme.SUNSET_BLOOM,
    StoryTheme.OCEAN_TIDE,
    StoryTheme.FOREST_MOSS,
    StoryTheme.MONO_ARCHIVE,
  ])
  theme?: StoryTheme;
}
