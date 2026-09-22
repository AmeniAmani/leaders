-- CreateTable
CREATE TABLE "User" (
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT,
    "idTeach" INTEGER,
    "active" BOOLEAN DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("login")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "birthday" TIMESTAMP(3),
    "idenelev" TEXT,
    "classId" INTEGER,
    "parentId" INTEGER,
    "photo" TEXT,
    "status" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "gender" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" SERIAL NOT NULL,
    "name1" TEXT,
    "relation1" TEXT,
    "email1" TEXT,
    "phone1" TEXT,
    "name2" TEXT,
    "relation2" TEXT,
    "email2" TEXT,
    "phone2" TEXT,
    "username" TEXT,
    "password" TEXT,
    "active" BOOLEAN DEFAULT true,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION,
    "paymentDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "as" TEXT,
    "type" TEXT,
    "studentId" INTEGER,
    "title" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "photo" TEXT,
    "iuense" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "diploma" TEXT,
    "subjectId" INTEGER,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "level" TEXT,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "capacity" INTEGER,
    "status" TEXT,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" SERIAL NOT NULL,
    "as" TEXT,
    "day" TEXT,
    "start" TEXT,
    "duration" INTEGER,
    "group" BOOLEAN DEFAULT false,
    "week" TEXT DEFAULT 'all',
    "subjectId" INTEGER,
    "roomId" INTEGER,
    "classId" INTEGER,
    "teacherId" INTEGER,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "codematiere" TEXT,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Taf" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER,
    "classId" INTEGER,
    "type" TEXT,
    "dateTaf" TIMESTAMP(3),
    "description" TEXT,

    CONSTRAINT "Taf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "target" INTEGER,
    "dateEvent" TIMESTAMP(3),
    "description" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "nameUser" TEXT,
    "dateActivity" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER,
    "classId" INTEGER,
    "teacherId" INTEGER,
    "dateAbsence" TIMESTAMP(3),
    "hour" TEXT,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planing" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER,
    "as" TEXT,
    "name" TEXT,
    "type" TEXT,
    "datePlaning" TIMESTAMP(3),
    "description" TEXT,
    "classId" INTEGER,

    CONSTRAINT "Planing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvaluation" (
    "id" SERIAL NOT NULL,
    "planingId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "note" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ressouce" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "planingId" INTEGER,
    "classId" INTEGER,

    CONSTRAINT "Ressouce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "tafId" INTEGER,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" SERIAL NOT NULL,
    "as" TEXT,
    "libperiodexam" TEXT,
    "idenelev" TEXT,
    "prenomnom" TEXT,
    "libematier" TEXT,
    "codematiere" TEXT,
    "abretypeeprear" TEXT,
    "libTypeEpr" TEXT,
    "iuense" TEXT,
    "libens" TEXT,
    "libeclass" TEXT,
    "codeclass" TEXT,
    "noteepre" DOUBLE PRECISION,
    "codeTypeEpre" INTEGER,
    "numEpre" INTEGER,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteDevoir" (
    "id" SERIAL NOT NULL,
    "as" TEXT,
    "libperiodexam" TEXT,
    "libTypeEpr" TEXT,
    "studentId" INTEGER,
    "subjectId" INTEGER,
    "classId" INTEGER,
    "noteepre" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAbsent" BOOLEAN DEFAULT false,

    CONSTRAINT "NoteDevoir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER,
    "sendTo" INTEGER,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClassToTeacher" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ClassToTeacher_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_idTeach_key" ON "User"("idTeach");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvaluation_planingId_studentId_key" ON "SessionEvaluation"("planingId", "studentId");

-- CreateIndex
CREATE INDEX "_ClassToTeacher_B_index" ON "_ClassToTeacher"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_idTeach_fkey" FOREIGN KEY ("idTeach") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Taf" ADD CONSTRAINT "Taf_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Taf" ADD CONSTRAINT "Taf_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planing" ADD CONSTRAINT "Planing_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planing" ADD CONSTRAINT "Planing_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvaluation" ADD CONSTRAINT "SessionEvaluation_planingId_fkey" FOREIGN KEY ("planingId") REFERENCES "Planing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvaluation" ADD CONSTRAINT "SessionEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ressouce" ADD CONSTRAINT "Ressouce_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ressouce" ADD CONSTRAINT "Ressouce_planingId_fkey" FOREIGN KEY ("planingId") REFERENCES "Planing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_tafId_fkey" FOREIGN KEY ("tafId") REFERENCES "Taf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDevoir" ADD CONSTRAINT "NoteDevoir_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDevoir" ADD CONSTRAINT "NoteDevoir_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDevoir" ADD CONSTRAINT "NoteDevoir_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_sendTo_fkey" FOREIGN KEY ("sendTo") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassToTeacher" ADD CONSTRAINT "_ClassToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassToTeacher" ADD CONSTRAINT "_ClassToTeacher_B_fkey" FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
