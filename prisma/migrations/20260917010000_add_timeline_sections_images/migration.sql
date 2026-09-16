
-- CreateTable
CREATE TABLE "TimelineSection" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineImage" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TimelineImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TimelineSection" ADD CONSTRAINT "TimelineSection_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TimelineEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineImage" ADD CONSTRAINT "TimelineImage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TimelineSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

