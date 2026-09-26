import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { isoler } from '../../../../lib/bidi';
import { enfant, notifyParentsOfStudent, prenomEleve } from '../../../../lib/notifications';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            classId,
            subjectId,
            libperiodexam,
            libTypeEpr,
            as,
            notes // Array of { studentId, noteepre, isAbsent }
        } = body;

        if (!classId || !subjectId || !libperiodexam || !libTypeEpr || !as || !notes) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const classIdInt = parseInt(classId);
        const subjectIdInt = parseInt(subjectId);

        // Fetch subject and students for notifications
        const [subject, students] = await Promise.all([
            prisma.subject.findUnique({
                where: { id: subjectIdInt },
                select: { name: true }
            }),
            prisma.student.findMany({
                where: { id: { in: notes.map((n: { studentId: number }) => n.studentId) } },
                select: { id: true, firstName: true, lastName: true }
            })
        ]);

        const studentMap = new Map(students.map((s: { id: number, firstName: string | null, lastName: string | null }) => [s.id, prenomEleve(s)]));

        // Process notes in an interactive transaction
        await prisma.$transaction(async (tx: any) => {
            for (const n of notes) {
                const where = {
                    studentId: n.studentId,
                    subjectId: subjectIdInt,
                    classId: classIdInt,
                    libperiodexam,
                    libTypeEpr,
                    as
                };

                const existing = await tx.noteDevoir.findFirst({ where });

                if (existing) {
                    await tx.noteDevoir.update({
                        where: { id: existing.id },
                        data: {
                            noteepre: n.noteepre,
                            isAbsent: n.isAbsent
                        }
                    });
                } else {
                    await tx.noteDevoir.create({
                        data: {
                            studentId: n.studentId,
                            subjectId: subjectIdInt,
                            classId: classIdInt,
                            libperiodexam,
                            libTypeEpr,
                            as,
                            noteepre: n.noteepre,
                            isAbsent: n.isAbsent
                        }
                    });
                }
            }
        });

        // Trigger notifications after successful save
        for (const n of notes) {
            const prenom = studentMap.get(n.studentId) ?? null;
            const subjectName = isoler(subject?.name) || "une matière";
            let title = "";
            let message = "";

            if (n.isAbsent) {
                title = "Absence au devoir";
                message = `Votre ${enfant(prenom)} est marqué(e) absent(e) pour le devoir ${libTypeEpr} en ${subjectName} (${libperiodexam}).`;
            } else if (n.noteepre !== null) {
                title = "Nouvelle note disponible";
                message = `La note de votre ${enfant(prenom)} pour le devoir ${libTypeEpr} en ${subjectName} (${libperiodexam}) est disponible : ${n.noteepre}/20.`;
            }

            if (title && message) {
                // We don't await each to avoid blocking the response, but fire and forget or use Promise.all later
                notifyParentsOfStudent(n.studentId, title, message, n.isAbsent ? "absence" : "note");
            }
        }

        return NextResponse.json({ success: true, count: notes.length });
    } catch (error: any) {
        console.error("Error saving notesDevoirs detailed:", {
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({ 
            error: error.message || "Internal Server Error",
            details: error.toString()
        }, { status: 500 });
    }
}
