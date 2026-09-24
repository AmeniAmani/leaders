import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server'
import { anneeScolaire, maintenant } from '../../../lib/emploi-du-temps'

// ?teacherId=<id> : seulement la salle attitrée de chacune des classes de
// l'enseignant (classes affectées ; à défaut, celles de son emploi du temps,
// comme /api/classes/teacher/<id>). Sans paramètre : toutes les salles.
export async function GET(request: Request) {
    const teacherIdParam = new URL(request.url).searchParams.get('teacherId')
    if (!teacherIdParam) {
        const rooms = await prisma.room.findMany()
        return NextResponse.json(rooms)
    }

    const teacherId = Number(teacherIdParam)
    const teacher = isNaN(teacherId) ? null : await prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, subjectId: true, classes: { select: { id: true } } }
    })
    if (!teacher) {
        return NextResponse.json([])
    }

    let classIds = teacher.classes.map(c => c.id)
    if (classIds.length === 0) {
        const schedules = await prisma.schedule.findMany({
            where: { teacherId: teacher.id, subjectId: teacher.subjectId, as: anneeScolaire(maintenant().date) },
            select: { classId: true }
        })
        classIds = Array.from(new Set(schedules.map(s => s.classId).filter((id): id is number => id !== null)))
    }

    const rooms = await prisma.room.findMany({
        where: { class: { id: { in: classIds } } },
        orderBy: { id: 'asc' }
    })
    return NextResponse.json(rooms)
}

export async function POST(request: Request) {
    try {
        const json = await request.json()
        const name = typeof json.name === 'string' ? json.name.trim() : ''

        if (!name) {
            return NextResponse.json({ error: "Le nom de la salle est obligatoire" }, { status: 400 })
        }

        // Nom unique, insensible à la casse
        const existante = await prisma.room.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        })
        if (existante) {
            return NextResponse.json({ error: `Une salle porte déjà le nom "${existante.name}"` }, { status: 400 })
        }

        const room = await prisma.room.create({
            data: {
                name: name,
                type: json.type,
                capacity: json.capacity ? Number(json.capacity) : null,
                status: json.status,
            }
        })
        // 1. Log Activity
        const cookiesStore = cookies();
        const nameuser = (await cookiesStore).get('user-name')?.value ?? "inconnu";
        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a créé une salle ${room.name}.`,
            }
        });
        return NextResponse.json(room)
    } catch (error) {
        console.error("Error creating room:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la création" }, { status: 500 })
    }
}