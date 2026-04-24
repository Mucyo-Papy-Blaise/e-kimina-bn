-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('USER', 'SUPER_ADMIN', 'GROUP_ADMIN', 'TREASURER', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GroupRemovalKind" AS ENUM ('REMOVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'PAID', 'LATE');

-- CreateEnum
CREATE TYPE "ContributionInterval" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DepositPaymentMethod" AS ENUM ('MTN_MOMO', 'MANUAL_TRANSFER');

-- CreateEnum
CREATE TYPE "DepositRecordStatus" AS ENUM ('PENDING', 'PENDING_VERIFICATION', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationOtpHash" TEXT,
    "emailVerificationExpiresAt" TIMESTAMP(3),
    "passwordResetOtpHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "minMembers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "treasurer_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasurer_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "membershipStatus" "GroupMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "customContributionAmount" DECIMAL(10,2),

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "user_platform_role" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_platform_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_config" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "repaymentPeriodDays" INTEGER NOT NULL,
    "allowExceedContribution" BOOLEAN NOT NULL DEFAULT false,
    "maxLoanMultiplier" DECIMAL(5,2),
    "allowPartialPayments" BOOLEAN NOT NULL DEFAULT true,
    "penaltyRate" DECIMAL(5,2),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "requestedAmount" DECIMAL(10,2) NOT NULL,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "interestRateSnapshot" DECIMAL(5,2) NOT NULL,
    "repaymentPeriodDaysSnapshot" INTEGER NOT NULL,
    "maxAmountSnapshot" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "contributionPortion" DECIMAL(10,2) NOT NULL,
    "finePortion" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "installmentPortion" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentMethod" "DepositPaymentMethod" NOT NULL,
    "phone" TEXT,
    "status" "DepositRecordStatus" NOT NULL DEFAULT 'PENDING',
    "proofImageUrl" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "groups_createdById_idx" ON "groups"("createdById");

-- CreateIndex
CREATE INDEX "contributions_groupId_dueDate_idx" ON "contributions"("groupId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_userId_groupId_dueDate_key" ON "contributions"("userId", "groupId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_config_groupId_key" ON "contribution_config"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "treasurer_invitations_token_key" ON "treasurer_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "treasurer_invitations_userId_key" ON "treasurer_invitations"("userId");

-- CreateIndex
CREATE INDEX "treasurer_invitations_token_idx" ON "treasurer_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "member_invitations_token_key" ON "member_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "member_invitations_userId_key" ON "member_invitations"("userId");

-- CreateIndex
CREATE INDEX "member_invitations_token_idx" ON "member_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_groups_groupId_idx" ON "user_groups"("groupId");

-- CreateIndex
CREATE INDEX "user_groups_userId_idx" ON "user_groups"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_userId_groupId_key" ON "user_groups"("userId", "groupId");

-- CreateIndex
CREATE INDEX "group_removal_notifications_userId_readAt_idx" ON "group_removal_notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_platform_role_userId_roleId_key" ON "user_platform_role"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_platform_role_userId_key" ON "user_platform_role"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_config_groupId_key" ON "loan_config"("groupId");

-- CreateIndex
CREATE INDEX "loan_applications_groupId_userId_idx" ON "loan_applications"("groupId", "userId");

-- CreateIndex
CREATE INDEX "loan_applications_userId_status_idx" ON "loan_applications"("userId", "status");

-- CreateIndex
CREATE INDEX "deposit_records_groupId_status_idx" ON "deposit_records"("groupId", "status");

-- CreateIndex
CREATE INDEX "deposit_records_groupId_userId_idx" ON "deposit_records"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_config" ADD CONSTRAINT "contribution_config_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasurer_invitations" ADD CONSTRAINT "treasurer_invitations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasurer_invitations" ADD CONSTRAINT "treasurer_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_removal_notifications" ADD CONSTRAINT "group_removal_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_platform_role" ADD CONSTRAINT "user_platform_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_platform_role" ADD CONSTRAINT "user_platform_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_config" ADD CONSTRAINT "loan_config_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_records" ADD CONSTRAINT "deposit_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_records" ADD CONSTRAINT "deposit_records_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_records" ADD CONSTRAINT "deposit_records_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
