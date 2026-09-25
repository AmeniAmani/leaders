import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { coursDuJour, dateDuJour, enMinutes, jourSemaine, maintenant } from '../../../../lib/emploi-du-temps';

export const dynamic = 'force-dynamic';

// "fait"              : un appel couvre au moins une heure du cours (un seul suffit pour 2 h)
// "non_fait"          : cours terminé, aucun appel
// "enseignant_absent" : absence de l'enseignant déclarée sur ce cours
// "a_venir"           : cours pas encore terminé
type Statut = "fait" | "non_fait" | "enseignant_absent" | "a_venir";

// Appels du jour, cours par cours d'après l'emploi du temps. Réservé à l'administration.
export async function GET(request: Request) {
    try {
        const store = await cookies();
        if (String(store.get('user-role')?.value || "") !== 'admin') {
            return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const jour = String(searchParams.get('date') || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || isNaN(new Date(jour).getTime())) {
            return NextResponse.json({ error: "Date invalide (AAAA-MM-JJ)" }, { status: 400 });
        }
        const date = dateDuJour(jour);

        const [cours, appels, absencesProfs] = await Promise.all([
            coursDuJour({ jour }),
            prisma.appel.findMany({
                where: { date },
                include: {
                    teacher: { select: { id: true, name: true } },
                    classe: { select: { id: true, name: true, level: true } },
                },
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.teacherAbsence.findMany({
                where: { dateStart: { lte: date }, dateEnd: { gte: date } },
                include: { classes: { select: { id: true } } },
            }),
        ]);

        // Heure actuelle à l'école : les cours pas encore terminés sont « à venir »
        const ecole = maintenant();
        const termine = (fin: number) => jour < ecole.date || (jour === ecole.date && ecole.minutes >= fin);

        // Absence déclarée de l'enseignant sur ce cours (journée entière ou heures qui le chevauchent)
        const enseignantAbsent = (c: { teacherId: number | null; classId: number | null; debut: number; fin: number }) =>
            absencesProfs.some(a => {
                if (a.teacherId !== c.teacherId) return false;
                if (!a.classes.some(k => k.id === c.classId)) return false;
                const d = enMinutes(a.hourStart), f = enMinutes(a.hourEnd);
                return d === null || f === null || (d < c.fin && f > c.debut);
            });

        // Appel qui couvre une heure du cours (le plus récent d'abord)
        const appelDe = (c: { classId: number | null; debut: number; fin: number }) =>
            appels.find(a => {
                const h = enMinutes(a.hour);
                return a.classId === c.classId && h !== null && h < c.fin && h + 60 > c.debut;
            });

        const utilises = new Set<number>();
        const lignes = cours.map(c => {
            const appel = appelDe(c);
            if (appel) utilises.add(appel.id);
            const statut: Statut =
                appel ? "fait" :
                enseignantAbsent(c) ? "enseignant_absent" :
                termine(c.fin) ? "non_fait" : "a_venir";
            return {
                id: c.id,
                start: c.start,
                debut: c.debut,
                fin: c.fin,
                classe: c.class,
                subjectName: c.subject?.name || null,
                teacher: c.teacher,
                statut,
                appel: appel ? {
                    hour: appel.hour,
                    hourEnd: appel.hourEnd,
                    faitPar: appel.faitPar,
                    teacherName: appel.teacher?.name || null,
                    nbSignales: appel.nbSignales,
                    source: appel.source,
                    createdAt: appel.createdAt,
                    updatedAt: appel.updatedAt,
                } : null,
            };
        });

        // Appels saisis sur un créneau où l'emploi du temps ne prévoit aucun cours pour la classe
        const horsEmploiDuTemps = appels
            .filter(a => !utilises.has(a.id))
            .sort((a, b) => a.hour.localeCompare(b.hour))
            .map(a => ({
                id: a.id,
                hour: a.hour,
                hourEnd: a.hourEnd,
                classe: a.classe,
                teacherName: a.teacher?.name || null,
                faitPar: a.faitPar,
                nbSignales: a.nbSignales,
                source: a.source,
                createdAt: a.createdAt,
            }));

        // Résumé par enseignant : appels faits sur les cours terminés (hors absence déclarée)
        const parProf = new Map<number, { teacherId: number; name: string | null; faits: number; dus: number; aVenir: number; absent: number }>();
        for (const l of lignes) {
            if (!l.teacher) continue;
            const r = parProf.get(l.teacher.id) || { teacherId: l.teacher.id, name: l.teacher.name, faits: 0, dus: 0, aVenir: 0, absent: 0 };
            if (l.statut === "fait") { r.faits++; r.dus++; }
            else if (l.statut === "non_fait") r.dus++;
            else if (l.statut === "a_venir") r.aVenir++;
            else r.absent++;
            parProf.set(l.teacher.id, r);
        }
        const parEnseignant = Array.from(parProf.values())
            .sort((a, b) => (b.dus - b.faits) - (a.dus - a.faits) || String(a.name).localeCompare(String(b.name)));

        return NextResponse.json({
            date: jour,
            jour: jourSemaine(jour),
            maintenant: jour === ecole.date ? ecole.minutes : null,
            cours: lignes,
            horsEmploiDuTemps,
            parEnseignant,
        });
    } catch (error) {
        console.error("Erreur appels du jour:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}
