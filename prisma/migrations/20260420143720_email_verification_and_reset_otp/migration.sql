-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationOtpHash" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetOtpHash" TEXT;

-- Grandfather existing active accounts (pre–email-verification feature).
UPDATE "users" SET "emailVerified" = true WHERE "isActive" = true;
