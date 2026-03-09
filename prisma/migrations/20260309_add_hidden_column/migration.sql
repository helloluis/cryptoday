-- AlterTable
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "hiddenReason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Article_hidden_idx" ON "Article"("hidden");
