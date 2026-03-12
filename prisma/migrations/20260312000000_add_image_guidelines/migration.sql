-- CreateTable
CREATE TABLE "ImageGuideline" (
    "id" TEXT NOT NULL,
    "guideline" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageGuideline_updatedAt_idx" ON "ImageGuideline"("updatedAt");
