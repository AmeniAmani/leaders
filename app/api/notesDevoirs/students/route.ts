import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { trierEleves } from '../../../../lib/eleves';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const classId = searchParams.get('classId');
        const subjectId = searchParams.get('subjectId');
        const libperiodexam = searchParams.get('libperiodexam');
        const libTypeEpr = searchParams.get('libTypeEpr');
        const as = searchParams.get('as');

        if (!classId || !subjectId || !libperiodexam || !libTypeEpr || !as) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const classIdInt = parseInt(classId);
        const subjectIdInt = parseInt(subjectId);

        // Fetch students of the class
        const students = await prisma.student.findMany({
            where: { classId: classIdInt },
            select: {
                id: true,
                firstName: true,
                lastName: true
            },
            orderBy: [
                { lastName: 'asc' },
                { firstName: 'asc' }
            ]
        });

        // Fetch existing notes
        const existingNotes = await prisma.noteDevoir.findMany({
            where: {
                classId: classIdInt,
                subjectId: subjectIdInt,
                libperiodexam: libperiodexam,
                libTypeEpr: libTypeEpr,
                as: as
            }
        });

        const notesMap = new Map(existingNotes.map(n => [n.studentId, n]));

        // Par nom, sans dépendre de la collation de la base
        const studentData = trierEleves(students).map(student => {
            const note = notesMap.get(student.id);
            return {
                id: student.id,
                name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                noteepre: note?.noteepre ?? null,
                isAbsent: note?.isAbsent ?? false,
                noteId: note?.id ?? null
            };
        });

        return NextResponse.json(studentData);
    } catch (error: any) {
        console.error("Error fetching notesDevoirs students:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
