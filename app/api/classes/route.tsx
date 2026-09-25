import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { isoler } from '../../../lib/bidi';
import { NextResponse } from 'next/server'

// Libellé arabe d'une classe, utilisé dans le journal d'activité
function libelleClasse(level: string | null, name: string | null) {
    if (level === "1") return "السابعة أساسي " + name
    if (level === "2") return "الثامنة أساسي " + name
    if (level === "3") return "التاسعة أساسي " + name
    return String(name ?? "")
}

export async function GET() {
    const classes = await prisma.class.findMany({
        orderBy: [
            {
                level: 'asc',
            },
            {
                name: 'asc',
            },
        ],
        include: {
            teachers: true,
            students: true,
            schedules: true,
            room: true
        }
    })
    return NextResponse.json(classes)
}

export async function POST(request: Request) {
    try {
        const json = await request.json()

        if (!json.level) {
            return NextResponse.json({ error: "Le niveau est obligatoire" }, { status: 400 })
        }
        if (!json.name || !String(json.name).trim()) {
            return NextResponse.json({ error: "Le nom de la classe est obligatoire" }, { status: 400 })
        }

        // Salle obligatoire
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
                name: json.name
            }
        })
        if (classes) {
            return NextResponse.json({ error: "Classe déjà existante" }, { status: 400 })
        }

        // Une salle ne peut être attribuée qu'à une seule classe
        const salleOccupee = await prisma.class.findFirst({
            where: { roomId }
        })
        if (salleOccupee) {
            return NextResponse.json(
                { error: `Cette salle est déjà attribuée à la classe ${isoler(libelleClasse(salleOccupee.level, salleOccupee.name))}` },
                { status: 400 }
            )
        }

        const newClass = await prisma.class.create({
            data: {
                name: json.name,
                level: json.level,
                codeclass: json.codeclass || null,
                roomId: roomId
            }
        })
        // 1. Log Activity
        const cookiesStore = cookies();
        const name = (await cookiesStore).get('user-name')?.value ?? "inconnu";
        const namecl = isoler(libelleClasse(newClass.level, newClass.name))
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a créé la classe ${namecl}`,
            }
        });
        return NextResponse.json(newClass)
    } catch (error) {
        console.error("Error creating class:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la création" }, { status: 500 })
    }
}