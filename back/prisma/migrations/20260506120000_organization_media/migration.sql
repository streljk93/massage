-- CreateTable
CREATE TABLE "OrganizationMedia" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationMedia_organizationId_sortOrder_idx" ON "OrganizationMedia"("organizationId", "sortOrder");

-- AddForeignKey
ALTER TABLE "OrganizationMedia" ADD CONSTRAINT "OrganizationMedia_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
