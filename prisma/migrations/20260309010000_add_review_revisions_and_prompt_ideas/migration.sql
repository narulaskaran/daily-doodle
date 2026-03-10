-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewRevision" (
    "id" TEXT NOT NULL,
    "coloringPageId" TEXT NOT NULL,
    "reviewComment" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "chosen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromptIdea" (
    "id" TEXT NOT NULL,
    "animal" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "props" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewRevision_coloringPageId_idx" ON "ReviewRevision"("coloringPageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromptIdea_used_idx" ON "PromptIdea"("used");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ReviewRevision_coloringPageId_fkey'
    ) THEN
        ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_coloringPageId_fkey" FOREIGN KEY ("coloringPageId") REFERENCES "ColoringPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
