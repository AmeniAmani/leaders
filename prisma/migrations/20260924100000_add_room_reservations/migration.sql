-- Réservation de salle (salle de cinéma) par les enseignants, validée par l'administration.
-- Migration uniquement additive : 1 table créée. Aucune ligne existante n'est modifiée.
-- (L'écart préexistant sur "_TeacherSubjects" est volontairement laissé de côté.)

-- CreateTable
CREATE TABLE "RoomReservation" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hour" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "motif" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "motifRefus" TEXT,
    "traiteAt" TIMESTAMP(3),
    "traitePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomReservation_roomId_date_idx" ON "RoomReservation"("roomId", "date");

-- CreateIndex
CREATE INDEX "RoomReservation_teacherId_idx" ON "RoomReservation"("teacherId");

-- AddForeignKey
ALTER TABLE "RoomReservation" ADD CONSTRAINT "RoomReservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomReservation" ADD CONSTRAINT "RoomReservation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomReservation" ADD CONSTRAINT "RoomReservation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

