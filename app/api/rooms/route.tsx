import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server'

export async function GET() {
    const rooms = await prisma.room.findMany()
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