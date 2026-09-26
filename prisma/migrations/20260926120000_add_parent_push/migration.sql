-- Notifications push des parents, et suppression d'une notification par le parent.
-- Migration uniquement additive : 1 table créée, 1 colonne facultative ajoutée. Aucune ligne existante n'est modifiée.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "hiddenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ParentDevice" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentDevice_token_key" ON "ParentDevice"("token");

-- CreateIndex
CREATE INDEX "ParentDevice_parentId_idx" ON "ParentDevice"("parentId");

-- AddForeignKey
ALTER TABLE "ParentDevice" ADD CONSTRAINT "ParentDevice_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
