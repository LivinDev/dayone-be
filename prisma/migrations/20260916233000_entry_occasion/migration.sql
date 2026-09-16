
-- CreateEnum
CREATE TYPE "EntryOccasion" AS ENUM ('SUNSET', 'BEACH_DAY', 'TREKKING', 'BIRTHDAY', 'AMUSEMENT_PARK', 'DATE_NIGHT', 'RESTAURANT');

-- AlterTable
ALTER TABLE "TimelineEntry" ADD COLUMN     "occasion" "EntryOccasion";
