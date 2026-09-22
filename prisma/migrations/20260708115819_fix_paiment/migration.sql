/*
  Warnings:

  - You are about to drop the column `amount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amount",
DROP COLUMN "title",
DROP COLUMN "type",
ADD COLUMN     "num" TEXT;

-- CreateTable
CREATE TABLE "PaymentLine" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numCheque" TEXT,

    CONSTRAINT "PaymentLine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentLine" ADD CONSTRAINT "PaymentLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
