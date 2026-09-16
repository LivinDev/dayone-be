-- CreateEnum
CREATE TYPE "DestinationKind" AS ENUM ('LINK', 'STORY');

-- CreateEnum
CREATE TYPE "StoryTheme" AS ENUM ('SUNSET_BLOOM', 'OCEAN_TIDE', 'FOREST_MOSS', 'MONO_ARCHIVE');

-- AlterTable
ALTER TABLE "NfcTag" ADD COLUMN     "destinationKind" "DestinationKind",
ADD COLUMN     "storyTheme" "StoryTheme";

-- AlterTable
ALTER TABLE "TimelineEntry" DROP COLUMN "photoUrl",
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "location" TEXT,
ALTER COLUMN "entryDate" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'APPROVED';

