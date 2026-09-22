import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server'

function libelleClasse(level: string | null, name: string | null) {
    if (level === "1") return "السابعة أساسي " + name
    if (level === "2") return "الثامنة أساسي " + name
    if (level === "3") return "التاسعة أساسي " + name
    return String(name ?? "")
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const classItem = await prisma.class.findUnique({
        where: {
            id: Number(params.id)
        },
        include: {
            teachers: true,
            students: true,
            schedules: true,
            room: true
        }
    })
    return NextResponse.json(classItem)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = Number(params.id)
    try {
        const json = await request.json()

        if (!json.roomId) {
            return NextResponse.json({ error: "La salle est obligatoire" }, { status: 400 })
        }
        const roomId = Number(json.roomId)
        if (isNaN(roomId)) {
            return NextResponse.json({ error: "Salle invalide" }, { status: 400 })
        }

        const classes = await prisma.class.findFirst({
            where: {
                level: json.level,
                name: json.name,
                NOT: {
                    id: id, // exclure l'objet courant
                },
            }
        })
        if (classes) {
            return NextResponse.json({ error: "Classe déjà existante" }, { status: 400 })
        }

        // Une salle ne peut être attribuée qu'à une seule classe
        const salleOccupee = await prisma.class.findFirst({
            where: {
                roomId,
                NOT: { id: id },
            }
        })
        if (salleOccupee) {
            return NextResponse.json(
                { error: `Cette salle est déjà attribuée à la classe ${libelleClasse(salleOccupee.level, salleOccupee.name)}` },
                { status: 400 }
            )
        }

        const updatedClass = await prisma.class.update({
            where: {
                id: id
            },
            data: {
                name: json.name,
                level: json.level,
                codeclass: json.codeclass || null,
                roomId: roomId,
            }
        })
        // 1. Log Activity
        const cookiesStore = cookies();
        const name = (await cookiesStore).get('user-name')?.value ?? "inconnu";
        const namecl = libelleClasse(updatedClass.level, updatedClass.name)
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a modifié la classe ${namecl}`,
            }
        });
        return NextResponse.json(updatedClass)
    } catch (error) {
        console.error("Error updating class:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la modification" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const deletedClass = await prisma.class.delete({
            where: {
                id: Number(params.id)
            }
        })
        // 1. Log Activity
        const cookiesStore = cookies();
        const name = (await cookiesStore).get('user-name')?.value ?? "inconnu";
        const namecl = libelleClasse(deletedClass.level, deletedClass.name)
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a supprimé la classe ${namecl}`,
            }
        });
        return NextResponse.json(deletedClass)
    } catch (error) {
        console.error("Error deleting class:", error)
        return NextResponse.json(
            { error: "Impossible de supprimer cette classe : elle contient des élèves, des cours ou des absences." },
            { status: 400 }
        )
    }
}