import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const room = await prisma.room.findUnique({
        where: {
            id: Number(params.id)
        }
    })
    return NextResponse.json(room)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = Number(params.id)
    try {
        const json = await request.json()
        const name = typeof json.name === 'string' ? json.name.trim() : ''

        if (!name) {
            return NextResponse.json({ error: "Le nom de la salle est obligatoire" }, { status: 400 })
        }

        // Nom unique, insensible à la casse (hors salle courante)
        const existante = await prisma.room.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                NOT: { id: id },
            }
        })
        if (existante) {
            return NextResponse.json({ error: `Une salle porte déjà le nom "${existante.name}"` }, { status: 400 })
        }

        const room = await prisma.room.update({
            where: {
                id: id
            },
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
                description: `a modifié une salle ${room.name}.`,
            }
        });
        return NextResponse.json(room)
    } catch (error) {
        console.error("Error updating room:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la modification" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const room = await prisma.room.delete({
            where: {
                id: Number(params.id)
            }
        })
        // 1. Log Activity
        const cookiesStore = cookies();
        const nameuser = (await cookiesStore).get('user-name')?.value ?? "inconnu";
        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a supprimé une salle ${room.name}.`,
            }
        });
        return NextResponse.json(room)
    } catch (error) {
        console.error("Error deleting room:", error)
        return NextResponse.json(
            { error: "Impossible de supprimer cette salle : elle est attribuée à une classe ou utilisée dans l'emploi du temps." },
            { status: 400 }
        )
    }
}