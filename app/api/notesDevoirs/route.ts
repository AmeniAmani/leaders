import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { trierEleves } from '../../../lib/eleves';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const classId = searchParams.get('classId');
        const subjectId = searchParams.get('subjectId');
        const libperiodexam = searchParams.get('libperiodexam');
        const as = searchParams.get('as');

        if (!classId || !subjectId || !libperiodexam || !as) {
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

        // Fetch all notes for this class, subject, period, and AS
        const allNotes = await prisma.noteDevoir.findMany({
            where: {
                classId: classIdInt,
                subjectId: subjectIdInt,
                libperiodexam: libperiodexam,
                as: as
            }
        });

        // Group notes by studentId
        const notesByStudent = new Map<number, any>();
        allNotes.forEach(note => {
            if (!note.studentId) return;
            if (!notesByStudent.has(note.studentId)) {
                notesByStudent.set(note.studentId, {});
            }
            const studentNotes = notesByStudent.get(note.studentId);
            studentNotes[note.libTypeEpr || ''] = {
                noteepre: note.noteepre,
                isAbsent: note.isAbsent
            };
        });

        // Get unique exam types from allNotes
        const existingTypes = Array.from(new Set(allNotes.map(n => n.libTypeEpr))).filter(Boolean) as string[];
        
        // Define the preferred order and filter by presence
        const preferredOrder = ['فرض مــراقبة1', 'فرض مــراقبة2', 'اشغال تطبيقية', 'شفوي', 'فرض تأليفي'];
        const examTypes = preferredOrder.filter(type => existingTypes.includes(type));
        
        // Add any other types found that are not in the preferred order
        existingTypes.forEach(type => { 
            if (!examTypes.includes(type)) {
                examTypes.push(type);
            }
        });

        // Par nom, sans dépendre de la collation de la base
        const studentData = trierEleves(students).map(student => {
            const grades: Record<string, { note: number | null, isAbsent: boolean }> = {};
            const stNotes = notesByStudent.get(student.id) || {};
            
            examTypes.forEach(type => {
                grades[type] = {
                    note: stNotes[type]?.noteepre ?? null,
                    isAbsent: stNotes[type]?.isAbsent ?? false
                };
            });

            return {
                id: student.id,
                name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                grades
            };
        });

        return NextResponse.json({
            students: studentData,
            examTypes
        });
    } catch (error: any) {
        console.error("Error fetching consolidated notesDevoirs:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
