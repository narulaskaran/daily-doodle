-- CreateTable
CREATE TABLE "ReviewRevision" (
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
CREATE TABLE "PromptIdea" (
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
CREATE INDEX "ReviewRevision_coloringPageId_idx" ON "ReviewRevision"("coloringPageId");

-- CreateIndex
CREATE INDEX "PromptIdea_used_idx" ON "PromptIdea"("used");

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_coloringPageId_fkey" FOREIGN KEY ("coloringPageId") REFERENCES "ColoringPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
