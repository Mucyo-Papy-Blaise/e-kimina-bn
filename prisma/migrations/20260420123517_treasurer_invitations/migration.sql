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

-- CreateIndex
CREATE UNIQUE INDEX "treasurer_invitations_token_key" ON "treasurer_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "treasurer_invitations_userId_key" ON "treasurer_invitations"("userId");

-- CreateIndex
CREATE INDEX "treasurer_invitations_token_idx" ON "treasurer_invitations"("token");

-- AddForeignKey
ALTER TABLE "treasurer_invitations" ADD CONSTRAINT "treasurer_invitations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasurer_invitations" ADD CONSTRAINT "treasurer_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
