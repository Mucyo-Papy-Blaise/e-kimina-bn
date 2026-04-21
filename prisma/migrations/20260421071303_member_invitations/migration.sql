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

-- CreateIndex
CREATE UNIQUE INDEX "member_invitations_token_key" ON "member_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "member_invitations_userId_key" ON "member_invitations"("userId");

-- CreateIndex
CREATE INDEX "member_invitations_token_idx" ON "member_invitations"("token");

-- AddForeignKey
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
