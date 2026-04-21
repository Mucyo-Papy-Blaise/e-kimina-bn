-- CreateEnum
CREATE TYPE "GroupMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GroupRemovalKind" AS ENUM ('REMOVED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN     "membershipStatus" "GroupMembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "group_removal_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "kind" "GroupRemovalKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_removal_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_removal_notifications_userId_readAt_idx" ON "group_removal_notifications"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "group_removal_notifications" ADD CONSTRAINT "group_removal_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
