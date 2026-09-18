-- CreateEnum
CREATE TYPE "GarmentTagRequestStatus" AS ENUM ('SUBMITTED', 'PICKUP_SCHEDULED', 'RECEIVED', 'TAG_INSTALLED', 'RETURNED', 'CANCELLED');

-- AlterTable
ALTER TABLE "NfcTag" ADD COLUMN     "tagInstallRequestId" TEXT;

-- CreateTable
CREATE TABLE "GarmentTagRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garmentPhotoUrl" TEXT NOT NULL,
    "garmentNote" TEXT,
    "markerX" DOUBLE PRECISION NOT NULL,
    "markerY" DOUBLE PRECISION NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "pickupLine1" TEXT NOT NULL,
    "pickupLine2" TEXT,
    "pickupCity" TEXT NOT NULL,
    "pickupState" TEXT NOT NULL,
    "pickupPincode" TEXT NOT NULL,
    "pickupLat" DOUBLE PRECISION,
    "pickupLng" DOUBLE PRECISION,
    "feeInPaise" INTEGER NOT NULL,
    "status" "GarmentTagRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarmentTagRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfcTag_tagInstallRequestId_key" ON "NfcTag"("tagInstallRequestId");

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_tagInstallRequestId_fkey" FOREIGN KEY ("tagInstallRequestId") REFERENCES "GarmentTagRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmentTagRequest" ADD CONSTRAINT "GarmentTagRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
