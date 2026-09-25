-- Appels enregistrés, même sans aucun élève signalé.
-- Migration uniquement additive : 1 table créée. Aucune ligne existante n'est modifiée.

-- CreateTable
CREATE TABLE "Appel" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "teacherId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "hour" TEXT NOT NULL,
    "hourEnd" TEXT NOT NULL,
    "faitPar" TEXT NOT NULL,
    "nbSignales" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'saisie',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appel_date_idx" ON "Appel"("date");

-- CreateIndex
CREATE INDEX "Appel_teacherId_date_idx" ON "Appel"("teacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Appel_classId_date_hour_key" ON "Appel"("classId", "date", "hour");

-- AddForeignKey
ALTER TABLE "Appel" ADD CONSTRAINT "Appel_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appel" ADD CONSTRAINT "Appel_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
