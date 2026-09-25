import prisma from '../../../lib/prisma';
import { erreurCours } from '../../../lib/cours';
import { NextResponse } from 'next/server'

export async function GET() {
    const schedule = await prisma.schedule.findMany({
        include: {
            room: true,
            class: true,
            teacher: true,
            subject: true
        }
    })
    return NextResponse.json(schedule)
}

export async function POST(request: Request) {
    try {
    const json = await request.json()

    const erreur = erreurCours(json)
    if (erreur) {
        return NextResponse.json({ error: erreur }, { status: 400 })
    }

    const schedule = await prisma.schedule.create({
        data: {
            as: json.as,
            day: json.day,
            start: json.start,
            duration: json.duration ? Number(json.duration) : null,
            subjectId: json.subjectId ? Number(json.subjectId) : null,
            roomId: json.roomId ? Number(json.roomId) : null,
            classId: json.classId ? Number(json.classId) : null,
            teacherId: json.teacherId ? Number(json.teacherId) : null,
            group: json.group === true,
            week: json.week || "all",
        }
    })
    return NextResponse.json(schedule)
    } catch (error) {
        console.error("Error saving schedule:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de l'ajout du cours" }, { status: 500 })
    }
}
