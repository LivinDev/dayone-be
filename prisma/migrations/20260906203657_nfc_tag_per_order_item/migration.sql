-- DropForeignKey
ALTER TABLE "NfcTag" DROP CONSTRAINT "NfcTag_orderId_fkey";

-- DropIndex
DROP INDEX "NfcTag_orderId_key";

-- AlterTable
ALTER TABLE "NfcTag" DROP COLUMN "orderId",
ADD COLUMN     "orderItemId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "quantity";

-- CreateIndex
CREATE UNIQUE INDEX "NfcTag_orderItemId_key" ON "NfcTag"("orderItemId");

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

