import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server'
import { notifyAllParents } from '../../../lib/notifications';
import { dateValide } from '../../../lib/erreur-api';

export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const filter = params.get("filter") ? params.get("filter") : 'next';
    const today = new Date().setHours(0, 0, 0, 0)
    const whereClause = filter === 'next' ? {
        dateEvent: { gte: new Date() }
    } : {};
    const events = await prisma.event.findMany({
        where: whereClause,
        orderBy: {
            dateEvent: 'asc'
        }
    })
    return NextResponse.json(events)
}

export async function POST(request: Request) {
    try {
    const json = await request.json()

    if (!json.name || !String(json.name).trim()) {
        return NextResponse.json({ error: "Le nom de l'événement est obligatoire" }, { status: 400 })
    }
    if (!dateValide(json.dateEvent)) {
        return NextResponse.json({ error: "La date de l'événement est obligatoire" }, { status: 400 })
    }

    const event = await prisma.event.create({
        data: {
            name: json.name,
            target: Number(json.target),
            dateEvent: json.dateEvent ? new Date(json.dateEvent) : null,
            description: json.description,
        }
    })

    // Send notification to all parents
    await notifyAllParents(
        "Nouvel événement",
        `${json.name} : ${json.description}`,
        "event"
    );

    // 1. Log Activity
    const cookiesStore = cookies();
    const name = String((await cookiesStore).get('user-name')?.value);
    await prisma.activity.create({
        data: {
            nameUser: name,
            description: `a créé l'événement ${event.name}`,
        }
    });

    return NextResponse.json(event)
    } catch (error) {
        console.error("Error creating event:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la création de l'événement" }, { status: 500 })
    }
}
