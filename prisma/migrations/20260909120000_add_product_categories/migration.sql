-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('MEN', 'WOMEN', 'TRIP', 'DATE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categories" "ProductCategory"[] DEFAULT ARRAY[]::"ProductCategory"[];
