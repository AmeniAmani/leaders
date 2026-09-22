-- Relation N-N additive entre Teacher et Subject.
-- Rien n'est supprime : Teacher."subjectId" et sa cle etrangere sont conservees.

-- CreateTable
CREATE TABLE "_TeacherSubjects" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TeacherSubjects_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TeacherSubjects_B_index" ON "_TeacherSubjects"("B");

-- AddForeignKey
ALTER TABLE "_TeacherSubjects" ADD CONSTRAINT "_TeacherSubjects_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeacherSubjects" ADD CONSTRAINT "_TeacherSubjects_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des donnees : chaque enseignant conserve sa matiere actuelle.
INSERT INTO "_TeacherSubjects" ("A", "B")
SELECT "subjectId", "id"
FROM "Teacher"
WHERE "subjectId" IS NOT NULL
ON CONFLICT DO NOTHING;
