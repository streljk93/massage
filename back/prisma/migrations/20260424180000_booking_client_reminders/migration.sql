-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bookingReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingReminderLeadMinutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "clientReminderSentAt" TIMESTAMP(3);
