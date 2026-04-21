-- AlterTable
ALTER TABLE "Advertisement" ADD COLUMN "refKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Advertisement_refKey_key" ON "Advertisement"("refKey");
