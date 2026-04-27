-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'DEPOSIT_MANUAL_PENDING',
  'DEPOSIT_RECORDED',
  'LOAN_REPAYMENT_RECORDED',
  'DEPOSIT_CONFIRMED',
  'LOAN_REPAYMENT_APPLIED',
  'DEPOSIT_REJECTED',
  'LOAN_APPLICATION_SUBMITTED',
  'LOAN_AWAITING_YOUR_APPROVAL',
  'LOAN_DISBURSED',
  'LOAN_REJECTED',
  'MANUAL_DEPOSIT_AUDIT_CONFIRM',
  'MANUAL_DEPOSIT_AUDIT_REJECT'
);

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM (
  'MEMBER',
  'GROUP_ADMIN',
  'TREASURER'
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "type" "NotificationType" NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_notifications_userId_readAt_createdAt_idx" ON "user_notifications"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_notifications_userId_audience_readAt_createdAt_idx" ON "user_notifications"("userId", "audience", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_notifications_groupId_createdAt_idx" ON "user_notifications"("groupId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
