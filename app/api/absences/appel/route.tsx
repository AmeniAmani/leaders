import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { dateDuJour, etatsAppel } from '../../../../lib/emploi-du-temps';

export const dynamic = 'force-dynamic';

// Feuille d'appel d'un créneau : les signalements déjà saisis, plus l'état
// calculé de chaque élève (encore absent, présent avec billet, billet de retard).
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const classId = Number(searchParams.get('classId'));
        const jour = searchParams.get('date');
        const hour = searchParams.get('hour');

        if (!classId || !jour || !hour) {
            return NextResponse.json({ error: "classId, date et hour sont requis" }, { status: 400 });
        }

        const [absences, etats] = await Promise.all([
            prisma.absence.findMany({
                where: { classId, dateAbsence: dateDuJour(jour), hour },
                include: { student: true, billet: { select: { id: true, type: true } } },
            }),
            etatsAppel(classId, jour, hour),
        ]);

        return NextResponse.json({ absences, etats });
    } catch (error) {
        console.error("Erreur feuille d'appel:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}
