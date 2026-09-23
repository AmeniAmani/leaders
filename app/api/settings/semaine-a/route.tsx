import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { CLE_REFERENCE_SEMAINE_A, maintenant, referenceSemaineA, semaineAB } from '../../../../lib/emploi-du-temps';

export const dynamic = 'force-dynamic';

// Référence de l'alternance A/B : un jour d'une semaine A (la rentrée).
// Réglée une fois par an ; l'alternance continue ensuite semaine après semaine.
export async function GET() {
    const reference = await referenceSemaineA();
    return NextResponse.json({ reference, semaineActuelle: semaineAB(maintenant().date, reference) });
}

export async function POST(request: Request) {
    try {
        const store = await cookies();
        if (String(store.get('user-role')?.value || "") !== 'admin') {
            return NextResponse.json({ error: "Action réservée à l'administration" }, { status: 403 });
        }

        const { reference } = await request.json();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reference)) || isNaN(new Date(reference).getTime())) {
            return NextResponse.json({ error: "Date invalide" }, { status: 400 });
        }

        await prisma.globalSetting.upsert({
            where: { key: CLE_REFERENCE_SEMAINE_A },
            update: { value: reference },
            create: { key: CLE_REFERENCE_SEMAINE_A, value: reference },
        });

        const nameuser = String(store.get('user-name')?.value || "Inconnu");
        await prisma.activity.create({
            data: { nameUser: nameuser, description: `a fixé le début de la semaine A de référence au ${reference}.` },
        });

        return NextResponse.json({ reference, semaineActuelle: semaineAB(maintenant().date, reference) });
    } catch (error) {
        console.error("Erreur réglage semaine A:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}
