-- AlterTable
ALTER TABLE "Absence" ADD COLUMN     "hourEnd" TEXT,
ADD COLUMN     "lateMinutes" INTEGER,
ADD COLUMN     "status" TEXT DEFAULT 'absence',
ADD COLUMN     "validated" BOOLEAN DEFAULT false,
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "codeclass" TEXT,
ADD COLUMN     "roomId" INTEGER;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "hoursLevel1" INTEGER,
ADD COLUMN     "hoursLevel2" INTEGER,
ADD COLUMN     "hoursLevel3" INTEGER;

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAbsence" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3) NOT NULL,
    "hourStart" TEXT,
    "hourEnd" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "TeacherAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAlert" (
    "id" SERIAL NOT NULL,
    "type" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TeacherAbsenceToClass" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TeacherAbsenceToClass_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TeacherAbsenceToClass_B_index" ON "_TeacherAbsenceToClass"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Class_roomId_key" ON "Class"("roomId");

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAbsence" ADD CONSTRAINT "TeacherAbsence_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeacherAbsenceToClass" ADD CONSTRAINT "_TeacherAbsenceToClass_A_fkey" FOREIGN KEY ("A") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeacherAbsenceToClass" ADD CONSTRAINT "_TeacherAbsenceToClass_B_fkey" FOREIGN KEY ("B") REFERENCES "TeacherAbsence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
