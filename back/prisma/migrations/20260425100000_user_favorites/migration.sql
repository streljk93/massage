-- CreateEnum
CREATE TYPE "FavoriteTargetKind" AS ENUM ('organization', 'specialist');

-- CreateTable
CREATE TABLE "UserFavorite" (
    "userId" TEXT NOT NULL,
    "targetKind" "FavoriteTargetKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("userId","targetKind","targetId")
);

-- CreateIndex
CREATE INDEX "UserFavorite_userId_idx" ON "UserFavorite"("userId");

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
