-- CreateEnum
CREATE TYPE "MemberLoanStatus" AS ENUM ('ACTIVE', 'REPAID', 'DEFAULTED');

-- AlterTable
ALTER TABLE "deposit_records" ADD COLUMN     "memberLoanId" TEXT;

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "groupAdminApprovedAt" TIMESTAMP(3),
ADD COLUMN     "groupAdminApprovedById" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedByUserId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "treasurerApprovedAt" TIMESTAMP(3),
ADD COLUMN     "treasurerApprovedById" TEXT;

-- CreateTable
CREATE TABLE "member_loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "principalAmount" DECIMAL(10,2) NOT NULL,
    "totalRepayable" DECIMAL(10,2) NOT NULL,
    "amountRepaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "interestRateSnapshot" DECIMAL(5,2) NOT NULL,
    "repaymentPeriodDaysSnapshot" INTEGER NOT NULL,
    "disbursedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MemberLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "penaltyAccrued" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_loans_applicationId_key" ON "member_loans"("applicationId");

-- CreateIndex
CREATE INDEX "member_loans_groupId_userId_status_idx" ON "member_loans"("groupId", "userId", "status");

-- CreateIndex
CREATE INDEX "deposit_records_memberLoanId_idx" ON "deposit_records"("memberLoanId");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_groupAdminApprovedById_fkey" FOREIGN KEY ("groupAdminApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_treasurerApprovedById_fkey" FOREIGN KEY ("treasurerApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loans" ADD CONSTRAINT "member_loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loans" ADD CONSTRAINT "member_loans_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loans" ADD CONSTRAINT "member_loans_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_records" ADD CONSTRAINT "deposit_records_memberLoanId_fkey" FOREIGN KEY ("memberLoanId") REFERENCES "member_loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
