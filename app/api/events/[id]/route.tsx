import { cookies } from 'next/headers';
import  prisma  from '../../../../lib/prisma';
import { NextResponse } from 'next/server'
import { dateValide } from '../../../../lib/erreur-api';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const event = await prisma.event.findUnique({
        where: {
            id: Number(params.id)
        }
    })
    return NextResponse.json(event)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
    const params = await props.params;
    const json = await request.json()

    if (!json.name || !String(json.name).trim()) {
        return NextResponse.json({ error: "Le nom de l'événement est obligatoire" }, { status: 400 })
    }
    if (!dateValide(json.dateEvent)) {
        return NextResponse.json({ error: "La date de l'événement est obligatoire" }, { status: 400 })
    }

    const event = await prisma.event.update({
        where: {
            id: Number(params.id)
        },
        data: {
            name: json.name,
            target: Number(json.target),
            dateEvent: new Date(json.dateEvent),
            description: json.description,
        }
    })

    // 1. Log Activity
        const cookiesStore = cookies();
        const name= String((await cookiesStore).get('user-name')?.value);
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a modifié l'événement ${event.name}`,
            }
        });
        
    return NextResponse.json(event)
    } catch (error) {
        console.error("Error updating event:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la modification de l'événement" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const event = await prisma.event.delete({
        where: {
            id: Number(params.id)
        }
    })

    // 1. Log Activity
    const cookiesStore = cookies();
    const name= String((await cookiesStore).get('user-name')?.value);
    await prisma.activity.create({
        data: {
            nameUser: name,
            description: `a supprimé l'événement ${event.name}`,
        }
    });

    return NextResponse.json(event)
}
