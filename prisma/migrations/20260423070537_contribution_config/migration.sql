-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'PAID', 'LATE');

-- CreateEnum
CREATE TYPE "ContributionInterval" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN     "customContributionAmount" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_config" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "interval" "ContributionInterval" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "allowPartialPayments" BOOLEAN NOT NULL DEFAULT false,
    "latePenaltyRate" DECIMAL(5,2),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribution_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributions_groupId_dueDate_idx" ON "contributions"("groupId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_userId_groupId_dueDate_key" ON "contributions"("userId", "groupId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_config_groupId_key" ON "contribution_config"("groupId");

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_config" ADD CONSTRAINT "contribution_config_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
