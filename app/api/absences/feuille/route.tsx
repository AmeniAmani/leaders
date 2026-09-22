import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';

// La journée complète, heure par heure. La pause déjeuner (12h-13h) est
// gérée séparément à l'affichage.
const HEURES_JOURNEE = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// "08:30" -> 510 (minutes depuis minuit)
const enMinutes = (h: string | null): number | null => {
    if (!h) return null;
    const [hh, mm] = h.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;
    return hh * 60 + mm;
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const classIdStr = searchParams.get('classId');
        const dateStr = searchParams.get('date');

        if (!classIdStr || !dateStr) {
            return NextResponse.json({ error: "classId et date sont requis" }, { status: 400 });
        }

        const classId = Number(classIdStr);
        const date = new Date(dateStr);
        const jour = JOURS[date.getDay()];

        // Année scolaire en cours (rentrée en septembre)
        const y = date.getFullYear();
        const as = date.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;

        const [classe, students, schedules, absences] = await Promise.all([
            prisma.class.findUnique({ where: { id: classId } }),
            prisma.student.findMany({
                where: { classId },
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
                select: { id: true, firstName: true, lastName: true }
            }),
            prisma.schedule.findMany({
                where: { classId, day: jour, as },
                include: { teacher: true, subject: true }
            }),
            prisma.absence.findMany({
                where: { classId, dateAbsence: date },
                include: { teacher: { include: { subject: true } } }
            }),
        ]);

        if (!classe) {
            return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
        }

        // Une colonne par heure de la journée. Une heure est "couverte"
        // s'il y a un cours à l'emploi du temps ou un appel saisi dessus.
        const slots = HEURES_JOURNEE.map((heure) => {
            const debutCol = enMinutes(heure)!;
            const finCol = debutCol + 60;

            // Cours de l'emploi du temps qui chevauche cette heure
            const cours = schedules.find((s) => {
                const d = enMinutes(s.start);
                if (d === null) return null;
                const f = d + Math.round((s.duration || 1) * 60);
                return d < finCol && f > debutCol;
            });

            // Appel saisi qui chevauche cette heure
            const appel = absences.find((a) => {
                const d = enMinutes(a.hour);
                if (d === null) return false;
                const f = enMinutes(a.hourEnd) ?? (d + 60);
                return d < finCol && f > debutCol;
            });

            return {
                hour: heure,
                hourEnd: `${String(Math.floor(finCol / 60)).padStart(2, "0")}:00`,
                teacherName: cours?.teacher?.name || appel?.teacher?.name || null,
                subjectName: cours?.subject?.name || appel?.teacher?.subject?.name || null,
                // Sans cours ni appel, la colonne reste vide
                couvert: Boolean(cours || appel),
            };
        });

        // Marque portée par chaque cellule : A (absent), E (exclu), R (retard)
        const lettre = (statut: string | null) =>
            statut === "exclusion" ? "E" : statut === "retard" ? "R" : "A";

        const absenceMap: Record<string, { mark: string; minutes: number | null }> = {};
        for (const a of absences) {
            if (!a.studentId || !a.hour) continue;
            const debut = enMinutes(a.hour);
            if (debut === null) continue;
            const fin = enMinutes(a.hourEnd) ?? (debut + 60);
            const marque = { mark: lettre(a.status), minutes: a.lateMinutes ?? null };

            for (const s of slots) {
                const d = enMinutes(s.hour)!;
                const f = d + 60;
                if (debut < f && fin > d) {
                    absenceMap[`${a.studentId}-${s.hour}`] = marque;
                }
            }
        }

        return NextResponse.json({
            classe,
            date: dateStr,
            jour,
            students,
            slots,
            absenceMap,
            // Journée sans aucune trace : ni cours planifié, ni appel saisi
            estVierge: schedules.length === 0 && absences.length === 0,
        });
    } catch (error) {
        console.error("Erreur feuille de présence:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}