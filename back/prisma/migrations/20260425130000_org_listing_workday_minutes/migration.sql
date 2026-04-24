-- График приёма для витрины (сетка слотов на клиенте).
ALTER TABLE "Organization" ADD COLUMN "listingWorkdayStartMinute" INTEGER NOT NULL DEFAULT 480;
ALTER TABLE "Organization" ADD COLUMN "listingWorkdayEndMinute" INTEGER NOT NULL DEFAULT 1320;
