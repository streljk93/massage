-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "bookingConfirmationGraceMinutes" INTEGER NOT NULL DEFAULT 15;

-- CreateIndex
CREATE INDEX "Booking_status_pendingExpiresAt_idx" ON "Booking"("status", "pendingExpiresAt");
