-- Billets d'entrée / de retard, notifications enseignants, envoi unique au parent par journée.
-- Migration uniquement additive : 3 tables créées, 1 colonne nullable ajoutée à "Absence".
-- Aucune ligne existante n'est modifiée ni supprimée.

-- CreateTable
CREATE TABLE "Billet" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hour" TEXT,
    "hourEnd" TEXT,
    "absenceId" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Billet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherNotification" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "billetId" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAbsenceNotice" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notificationId" INTEGER,
    "sentBy" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentAbsenceNotice_pkey" PRIMARY KEY ("id")
);

-- AlterTable (colonne nullable : les lignes existantes restent à NULL)
ALTER TABLE "Absence" ADD COLUMN "parentNoticeId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Billet_absenceId_key" ON "Billet"("absenceId");
CREATE INDEX "Billet_studentId_date_idx" ON "Billet"("studentId", "date");
CREATE INDEX "TeacherNotification_teacherId_read_idx" ON "TeacherNotification"("teacherId", "read");
CREATE UNIQUE INDEX "ParentAbsenceNotice_studentId_date_key" ON "ParentAbsenceNotice"("studentId", "date");

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_parentNoticeId_fkey"
    FOREIGN KEY ("parentNoticeId") REFERENCES "ParentAbsenceNotice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Billet" ADD CONSTRAINT "Billet_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Billet" ADD CONSTRAINT "Billet_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Billet" ADD CONSTRAINT "Billet_absenceId_fkey"
    FOREIGN KEY ("absenceId") REFERENCES "Absence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherNotification" ADD CONSTRAINT "TeacherNotification_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherNotification" ADD CONSTRAINT "TeacherNotification_billetId_fkey"
    FOREIGN KEY ("billetId") REFERENCES "Billet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParentAbsenceNotice" ADD CONSTRAINT "ParentAbsenceNotice_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
