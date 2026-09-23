import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { coursA, coursDuJour, creneauDe, enHeure, maintenant } from '../../../../lib/emploi-du-temps';

export const dynamic = 'force-dynamic';

// Cours en cours pour un enseignant, d'après l'emploi du temps lu à l'instant.
// Sert à pré-remplir la feuille d'appel à chaque ouverture.
export async function GET(request: Request) {
    try {
        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");
        const { searchParams } = new URL(request.url);

        // Un enseignant ne voit que son propre emploi du temps
        const teacherId = Number(role === 'admin' ? searchParams.get('teacherId') : store.get('user-id')?.value);
        if (!teacherId) {
            return NextResponse.json({ date: maintenant().date, cours: [] });
        }

        const { date, minutes } = maintenant();
        const cours = await coursDuJour({ jour: date, teacherId });
        const creneau = creneauDe(minutes);

        return NextResponse.json({
            date,
            heure: enHeure(minutes),
            // Plusieurs cours possibles au même moment (groupes) : l'enseignant choisit
            cours: coursA(cours, minutes).map(c => ({
                classId: c.classId,
                subjectName: c.subject?.name || null,
                start: c.start,
                ...creneau,
            })),
        });
    } catch (error) {
        console.error("Erreur créneau actuel:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}
