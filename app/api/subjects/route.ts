import { cookies } from 'next/headers';
import  prisma  from '../../../lib/prisma';
import { NextResponse } from 'next/server'

// Un volume horaire valide, ou null si le niveau n'est pas concerné
const heures = (valeur: any): number | null => {
    if (valeur === null || valeur === undefined || valeur === "") return null;
    const n = Number(valeur);
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n);
};

export async function GET() {
    const subjects = await prisma.subject.findMany({
        orderBy: { name: 'asc' },
        include: {
            teachers: true
        }
    })
    return NextResponse.json(subjects)
}

export async function POST(request: Request) {
    try {
        const json = await request.json()

        if (!json.name || !String(json.name).trim()) {
            return NextResponse.json(
                { error: 'Le nom de la matière est obligatoire' },
                { status: 400 }
            )
        }

        const h1 = heures(json.hoursLevel1);
        const h2 = heures(json.hoursLevel2);
        const h3 = heures(json.hoursLevel3);

        // Une matière doit être enseignée dans au moins un niveau
        if (h1 === null && h2 === null && h3 === null) {
            return NextResponse.json(
                { error: "Indiquez le nombre d'heures par semaine pour au moins un niveau" },
                { status: 400 }
            )
        }

        const subject = await prisma.subject.create({
            data: {
                name: String(json.name).trim(),
                codematiere: json.codematiere || null,
                hoursLevel1: h1,
                hoursLevel2: h2,
                hoursLevel3: h3,
            }
        })

        // Journal d'activité
        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value || "Inconnu");
        const detail = [
            h1 ? `7ème ${h1}h` : null,
            h2 ? `8ème ${h2}h` : null,
            h3 ? `9ème ${h3}h` : null,
        ].filter(Boolean).join(', ');

        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a créé la matière ${subject.name} (${detail}).`,
            }
        });

        return NextResponse.json(subject)
    } catch (error) {
        console.error("Erreur création matière:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la création" }, { status: 500 })
    }
}