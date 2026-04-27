-- AlterEnum: add notification types for proof ack, invites, new members
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_PROOF_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'ADDED_TO_GROUP';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_GROUP_MEMBER';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_INVITATION_PENDING';
