import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { coursDuJour, dateDuJour, enHeure, enMinutes, jourSemaine } from '../../../../lib/emploi-du-temps';
import { trierEleves } from '../../../../lib/eleves';

export const dynamic = 'force-dynamic';

// La journée complète, heure par heure. La pause déjeuner (12h-13h) est
// gérée séparément à l'affichage.
const HEURES_JOURNEE = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

type Marque = { mark: string; minutes: number | null };

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const classIdStr = searchParams.get('classId');
        const dateStr = searchParams.get('date');

        if (!classIdStr || !dateStr) {
            return NextResponse.json({ error: "classId et date sont requis" }, { status: 400 });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return NextResponse.json({ error: "Date invalide (AAAA-MM-JJ)" }, { status: 400 });
        }

        const classId = Number(classIdStr);
        const date = dateDuJour(dateStr);

        const [classe, students, cours, absences, appels] = await Promise.all([
            prisma.class.findUnique({ where: { id: classId } }),
            prisma.student.findMany({
                where: { classId },
                select: { id: true, firstName: true, lastName: true }
            }).then(trierEleves),
            // Emploi du temps du jour, semaine A/B comprise
            coursDuJour({ jour: dateStr, classId }),
            prisma.absence.findMany({
                where: { classId, dateAbsence: date },
                include: { teacher: { include: { subject: true } } }
            }),
            prisma.appel.findMany({
                where: { classId, date },
                include: { teacher: { select: { name: true } } }
            }),
        ]);

        if (!classe) {
            return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
        }

        // Billets d'entrée valables des élèves de la classe : à partir de l'heure du
        // billet, l'élève est présent (même logique que etatsAppel)
        const billets = await prisma.billet.findMany({
            where: { studentId: { in: students.map(s => s.id) }, date, type: "entree", statut: { not: "non_arrive" } },
            select: { studentId: true, hour: true },
        });

        // Heures où un appel a été saisi : ligne Appel, ou absence saisie dessus
        // (créneaux antérieurs à la table Appel)
        const heuresAppelees = new Set<number>();
        for (const a of appels) {
            const d = enMinutes(a.hour);
            if (d !== null) heuresAppelees.add(d);
        }
        for (const a of absences) {
            const d = enMinutes(a.hour);
            if (d === null) continue;
            const f = enMinutes(a.hourEnd) ?? (d + 60);
            for (const h of HEURES_JOURNEE) {
                const m = enMinutes(h)!;
                if (d < m + 60 && f > m) heuresAppelees.add(m);
            }
        }

        // Marques saisies, par heure : A (absent), E (exclu), R (retard)
        const lettre = (statut: string | null) =>
            statut === "exclusion" ? "E" : statut === "retard" ? "R" : "A";
        const saisies = new Map<string, Marque>(); // `${studentId}-${minutes}`
        for (const a of absences) {
            if (!a.studentId || !a.hour) continue;
            const debut = enMinutes(a.hour);
            if (debut === null) continue;
            const fin = enMinutes(a.hourEnd) ?? (debut + 60);
            for (const h of HEURES_JOURNEE) {
                const m = enMinutes(h)!;
                if (debut < m + 60 && fin > m) {
                    saisies.set(`${a.studentId}-${m}`, { mark: lettre(a.status), minutes: a.lateMinutes ?? null });
                }
            }
        }

        // Heures pleines couvertes par un cours
        const heuresDu = (c: { debut: number; fin: number }) => {
            const heures: number[] = [];
            for (let m = Math.floor(c.debut / 60) * 60; m < c.fin; m += 60) heures.push(m);
            return heures;
        };

        // Un seul appel vaut pour tout le cours : une heure sans appel reprend celui d'une
        // autre heure du même cours (la plus proche avant elle, sinon après)
        const heureDeReference = (m: number, coursHeure: { debut: number; fin: number }[]): number | null => {
            if (heuresAppelees.has(m)) return m;
            const candidates = Array.from(new Set(coursHeure.flatMap(heuresDu)))
                .filter(h => h !== m && heuresAppelees.has(h));
            const avant = candidates.filter(h => h < m).sort((a, b) => b - a);
            const apres = candidates.filter(h => h > m).sort((a, b) => a - b);
            return avant[0] ?? apres[0] ?? null;
        };

        // Billet d'entrée émis après l'heure de l'appel, au plus tard à cette heure-ci
        const revenuAvecBillet = (studentId: number, depuis: number, jusqua: number) =>
            billets.some(b => {
                const h = enMinutes(b.hour);
                return b.studentId === studentId && h !== null && h > depuis && h <= jusqua;
            });

        const absenceMap: Record<string, Marque> = {};

        // Une colonne par heure de la journée. Une heure est "couverte"
        // s'il y a un cours à l'emploi du temps ou un appel saisi dessus.
        const slots = HEURES_JOURNEE.map((heure) => {
            const debutCol = enMinutes(heure)!;
            const finCol = debutCol + 60;

            // Cours de l'emploi du temps qui chevauchent cette heure
            const coursHeure = cours.filter(c => c.debut < finCol && c.fin > debutCol);
            const premier = coursHeure[0];

            const reference = heureDeReference(debutCol, coursHeure);
            const appelFait = reference !== null;

            // Enseignant de l'appel quand l'emploi du temps ne prévoit rien
            const appelSaisi = appels.find(a => enMinutes(a.hour) === debutCol);
            const absenceSaisie = absences.find(a => {
                const d = enMinutes(a.hour);
                if (d === null) return false;
                const f = enMinutes(a.hourEnd) ?? (d + 60);
                return d < finCol && f > debutCol;
            });

            // Marques de l'heure : celles saisies, ou celles de l'appel du même cours
            if (reference !== null) {
                for (const st of students) {
                    const m = saisies.get(`${st.id}-${reference}`);
                    if (!m) continue;
                    if (reference === debutCol) {
                        absenceMap[`${st.id}-${heure}`] = m;
                        continue;
                    }
                    // Le retard ne vaut que pour l'heure où il a été saisi
                    if (m.mark === "R") continue;
                    // Revenu avec un billet d'entrée : présent à partir de l'heure du billet
                    if (m.mark === "A" && reference < debutCol && revenuAvecBillet(st.id, reference, debutCol)) continue;
                    absenceMap[`${st.id}-${heure}`] = { mark: m.mark, minutes: null };
                }
            }

            return {
                hour: heure,
                hourEnd: enHeure(finCol),
                teacherName: premier?.teacher?.name || appelSaisi?.teacher?.name || absenceSaisie?.teacher?.name || null,
                subjectName: premier?.subject?.name || absenceSaisie?.teacher?.subject?.name || null,
                // Sans cours ni appel, la colonne reste vide
                couvert: Boolean(premier || appelFait),
                // Cours sans appel : la colonne reste vide tant que l'appel n'est pas fait
                appelFait,
            };
        });

        return NextResponse.json({
            classe,
            date: dateStr,
            jour: jourSemaine(dateStr),
            students,
            slots,
            absenceMap,
            // Journée sans aucune trace : ni cours planifié, ni appel saisi
            estVierge: cours.length === 0 && absences.length === 0 && appels.length === 0,
        });
    } catch (error) {
        console.error("Erreur feuille de présence:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}
