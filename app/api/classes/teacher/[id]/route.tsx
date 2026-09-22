import prisma from '../../../../../lib/prisma';
import { NextResponse } from 'next/server'

// Ce que l'on renvoie pour chaque classe, identique à /api/classes
const CLASS_INCLUDE = {
    teachers: true,
    students: true,
    schedules: true,
} as const;

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    // id = 0 : toutes les classes (cas administrateur)
    if (params.id === "0") {
        return NextResponse.json(await prisma.class.findMany({
            orderBy: [
                { level: 'asc' },
                { name: 'asc' },
            ],
            include: CLASS_INCLUDE
        }));
    }

    const teacherId = Number(params.id);
    if (isNaN(teacherId)) {
        return NextResponse.json({ error: "Identifiant enseignant invalide" }, { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
            subject: true,
            classes: { select: { id: true } }
        }
    });

    if (!teacher) {
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    // 1. Source principale : les classes assignées à l'enseignant par l'administration
    let classIds = teacher.classes.map((c) => c.id);

    // 2. Repli : tant qu'aucune classe ne lui a été assignée, on déduit ses
    //    classes de l'emploi du temps de l'année en cours.
    if (classIds.length === 0) {
        const now = new Date();
        const year = now.getFullYear();
        // L'année scolaire démarre en septembre (getMonth() est indexé à 0)
        const currentAS = now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;

        const schedules = await prisma.schedule.findMany({
            where: {
                teacherId: teacher.id,
                subjectId: teacher.subjectId,
                as: currentAS,
            },
            select: { classId: true }
        });

        classIds = Array.from(new Set(
            schedules
                .map((s) => s.classId)
                .filter((id): id is number => id !== null)
        ));
    }

    if (classIds.length === 0) {
        return NextResponse.json([]);
    }

    const classes = await prisma.class.findMany({
        where: { id: { in: classIds } },
        orderBy: [
            { level: 'asc' },
            { name: 'asc' },
        ],
        include: CLASS_INCLUDE
    });

    return NextResponse.json(classes)
}