/*
  Warnings:

  - You are about to drop the column `maxLoanAmount` on the `loan_config` table. All the data in the column will be lost.
  - You are about to alter the column `interestRate` on the `loan_config` table. The data in that column could be lost. The data in that column will be cast from `Decimal(8,5)` to `Decimal(5,2)`.
  - You are about to alter the column `penaltyRate` on the `loan_config` table. The data in that column could be lost. The data in that column will be cast from `Decimal(8,5)` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE "loan_config" DROP COLUMN "maxLoanAmount",
ADD COLUMN     "allowExceedContribution" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxLoanMultiplier" DECIMAL(5,2),
ALTER COLUMN "interestRate" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "penaltyRate" DROP NOT NULL,
ALTER COLUMN "penaltyRate" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "allowPartialPayments" SET DEFAULT true;
