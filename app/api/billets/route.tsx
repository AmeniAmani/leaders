import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server';
import {
    coursA, coursDuJour, coursSurCreneau, creneauDe, enMinutes, enseignantsDe, jourDe, maintenant,
} from '../../../lib/emploi-du-temps';

// Émission d'un billet par l'administration, depuis une ligne de la liste des absences.
// - ligne « Absent » -> billet d'entrée pour le créneau d'une heure qui suit
//   l'émission (émis à 9h40 -> créneau de 10h, même si le cours de 9h dure deux
//   heures), ou à défaut le premier cours suivant de la journée ; s'il n'en reste
//   aucun, le billet est seulement enregistré. L'enseignant de ce créneau valide
//   ensuite l'arrivée de l'élève (billets/valider).
// - ligne « Retard » -> billet de retard, pour l'enseignant du créneau du retard.
// Le billet ne supprime ni ne modifie l'absence d'origine. Rien n'est envoyé au parent.
export async function POST(request: Request) {
    try {
        const { absenceId } = await request.json();

        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");
        const nameuser = String(store.get('user-name')?.value || "Inconnu");

        if (role !== 'admin') {
            return NextResponse.json({ error: "Seule l'administration peut émettre un billet" }, { status: 403 });
        }
        if (!absenceId) {
            return NextResponse.json({ error: "absenceId requis" }, { status: 400 });
        }

        const absence = await prisma.absence.findUnique({
            where: { id: Number(absenceId) },
            include: { student: { select: { firstName: true, lastName: true } } },
        });
        if (!absence || !absence.studentId || !absence.classId || !absence.dateAbsence) {
            return NextResponse.json({ error: "Signalement introuvable ou incomplet" }, { status: 404 });
        }

        const type = absence.status === "retard" ? "retard" : (absence.status || "absence") === "absence" ? "entree" : null;
        if (!type) {
            return NextResponse.json({ error: "Pas de billet pour une exclusion" }, { status: 400 });
        }

        const { date: aujourdhui, minutes } = maintenant();
        const jour = jourDe(absence.dateAbsence);
        if (jour > aujourdhui) {
            return NextResponse.json({ error: "Ce signalement est daté d'un jour à venir" }, { status: 400 });
        }
        const estAujourdhui = jour === aujourdhui;
        const nomEleve = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : `élève ID ${absence.studentId}`;

        // Créneau où le billet s'applique, et enseignants à prévenir
        let hour: string | null = null;
        let hourEnd: string | null = null;
        let enseignants: number[] = [];
        let situation: "prochain" | "aucun_cours" | "retard" | "regularisation";

        const cours = await coursDuJour({ jour, classId: absence.classId });

        if (type === "retard") {
            hour = absence.hour;
            hourEnd = absence.hourEnd || (enMinutes(absence.hour) !== null ? creneauDe(enMinutes(absence.hour)!).hourEnd : null);
            situation = "retard";
            if (estAujourdhui && hour) {
                enseignants = enseignantsDe(coursSurCreneau(cours, hour));
                // Cours absent de l'emploi du temps : l'enseignant qui a saisi le retard
                if (enseignants.length === 0 && absence.teacherId) enseignants = [absence.teacherId];
            }
        } else if (!estAujourdhui) {
            situation = "regularisation";
        } else {
            // Première minute de cours à partir de l'heure pleine suivante
            const heureSuivante = Math.floor(minutes / 60) * 60 + 60;
            const suivants = cours.filter(c => c.fin > heureSuivante);
            if (suivants.length > 0) {
                const debut = Math.min(...suivants.map(c => Math.max(c.debut, heureSuivante)));
                ({ hour, hourEnd } = creneauDe(debut));
                enseignants = enseignantsDe(coursA(cours, debut));
                situation = "prochain";
            } else {
                situation = "aucun_cours";
            }
        }

        const billet = await prisma.$transaction(async (tx) => {
            // Un billet à la fois par élève : sérialise les clics simultanés
            await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${absence.studentId} FOR UPDATE`;

            if (await tx.billet.findUnique({ where: { absenceId: absence.id } })) {
                throw new ErreurMetier("Un billet a déjà été émis pour ce signalement");
            }

            if (type === "entree") {
                // Un seul billet d'entrée tant que l'élève n'a pas été de nouveau
                // signalé absent après ce billet ; un billet « non arrivé » ne compte pas
                const dernier = await tx.billet.findFirst({
                    where: { studentId: absence.studentId!, date: absence.dateAbsence!, type: "entree", statut: { not: "non_arrive" } },
                    orderBy: { createdAt: 'desc' },
                });
                if (dernier) {
                    const plusTardive = await tx.absence.findFirst({
                        where: { studentId: absence.studentId!, dateAbsence: absence.dateAbsence!, status: "absence" },
                        select: { hour: true },
                        orderBy: { hour: 'desc' },
                    });
                    const derniereAbsence = enMinutes(plusTardive?.hour) ?? -1;
                    const dernierBillet = enMinutes(dernier.hour) ?? Infinity;
                    if (derniereAbsence <= dernierBillet) {
                        throw new ErreurMetier(`Un billet d'entrée a déjà été émis pour ${nomEleve} ce jour-là`);
                    }
                }
            }

            const cree = await tx.billet.create({
                data: {
                    type,
                    studentId: absence.studentId!,
                    classId: absence.classId!,
                    date: absence.dateAbsence!,
                    hour,
                    hourEnd,
                    absenceId: absence.id,
                    createdBy: nameuser,
                    ...(type === "entree" && situation === "prochain" ? {} : { statut: "valide", traiteAt: new Date(), traitePar: nameuser }),
                },
            });

            const libelle = type === "entree" ? "Billet d'entrée" : "Billet de retard";
            if (enseignants.length > 0) {
                await tx.teacherNotification.createMany({
                    data: enseignants.map(teacherId => ({
                        teacherId,
                        type: "billet",
                        title: libelle,
                        message: `L'administration a envoyé un billet pour ${nomEleve}` +
                            (hour ? ` (${libelle.toLowerCase()}, cours de ${hour} à ${hourEnd}).` : ".") +
                            (type === "entree" ? " Validez son arrivée quand l'élève se présente." : ""),
                        billetId: cree.id,
                    })),
                });
            }

            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a émis un ${libelle.toLowerCase()} pour ${nomEleve}` +
                        (hour ? ` (cours de ${hour})` : " (aucun cours restant ce jour-là)") + ".",
                },
            });
            return cree;
        });

        const destinataires = enseignants.length > 0
            ? await prisma.teacher.findMany({ where: { id: { in: enseignants } }, select: { name: true } })
            : [];

        return NextResponse.json({
            success: true,
            billet,
            situation,
            destinataires: destinataires.map(t => t.name),
        });
    } catch (error) {
        if (error instanceof ErreurMetier) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        console.error("Erreur émission billet:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de l'émission du billet" }, { status: 500 });
    }
}

class ErreurMetier extends Error {}
