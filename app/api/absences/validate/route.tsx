import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { enfant, notifyParentsOfStudent, prenomEleve } from '../../../../lib/notifications';
import { rattacherAuPrevenu } from '../../../../lib/absences-parent';

// Envoie une absence au parent, puis la marque comme validée.
// Réservé à l'administration.
// - Absence : une seule notification par élève et par jour. Les autres lignes
//   de la journée sont rattachées à ce premier envoi, sans nouvelle notification.
// - Retard, exclusion : une notification par incident.
export async function POST(request: Request) {
    try {
        const { absenceId } = await request.json();

        if (!absenceId) {
            return NextResponse.json({ error: "absenceId requis" }, { status: 400 });
        }

        const cookiesStore = cookies();
        const store = await cookiesStore;
        const role = String(store.get('user-role')?.value || "");
        const nameuser = String(store.get('user-name')?.value || "Inconnu");

        if (role !== 'admin') {
            return NextResponse.json(
                { error: "Seule l'administration peut envoyer une absence au parent" },
                { status: 403 }
            );
        }

        const absence = await prisma.absence.findUnique({
            where: { id: Number(absenceId) },
            include: {
                student: { select: { id: true, firstName: true, lastName: true, parentId: true } },
                billet: { select: { id: true } },
            }
        });

        if (!absence) {
            return NextResponse.json({ error: "Absence introuvable" }, { status: 404 });
        }

        if (absence.validated) {
            return NextResponse.json(
                { error: "Cette absence a déjà été envoyée au parent" },
                { status: 409 }
            );
        }

        if (!absence.studentId) {
            return NextResponse.json({ error: "Absence sans élève rattaché" }, { status: 400 });
        }

        if ((absence.status || "absence") === "absence") {
            if (!absence.dateAbsence) {
                return NextResponse.json({ error: "Absence sans date" }, { status: 400 });
            }
            return await envoyerJournee({
                absenceId: absence.id,
                studentId: absence.studentId,
                parentId: absence.student?.parentId ?? null,
                date: absence.dateAbsence,
                nomEleve: absence.student
                    ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
                    : `élève ID ${absence.studentId}`,
                prenom: prenomEleve(absence.student),
                nameuser,
            });
        }

        const formattedDate = absence.dateAbsence
            ? new Date(absence.dateAbsence).toLocaleDateString('fr-FR')
            : "";

        // Message adapté au type de signalement
        const creneau = absence.hourEnd
            ? `de ${absence.hour} à ${absence.hourEnd}`
            : `à ${absence.hour || ""}`;

        let titre = "";
        let corps = "";
        const prenom = prenomEleve(absence.student);

        if (absence.status === "exclusion") {
            titre = "Exclusion de cours";
            corps = `Votre ${enfant(prenom)} a été exclu(e) du cours le ${formattedDate} ${creneau}.`;
        } else if (absence.status === "retard") {
            titre = "Retard";
            corps = absence.lateMinutes
                ? `Votre ${enfant(prenom)} est arrivé(e) avec ${absence.lateMinutes} minutes de retard le ${formattedDate}, au cours ${creneau}.`
                : `Votre ${enfant(prenom)} est arrivé(e) en retard le ${formattedDate}, au cours ${creneau}.`;
            if (absence.billet) {
                corps += " Un billet de retard lui a été délivré par l'administration.";
            }
        }

        // 1. Notifier le parent
        await notifyParentsOfStudent(
            absence.studentId,
            titre,
            corps,
            "absence"
        );

        // 2. Marquer comme envoyée + journal + fermer l'alerte de cet élève
        const nomEleve = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : `élève ID ${absence.studentId}`;

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.absence.update({
                where: { id: absence.id },
                data: { validated: true, validatedAt: new Date() }
            });

            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a envoyé au parent l'absence de ${nomEleve} du ${formattedDate} à ${absence.hour || ""}.`,
                }
            });

            // 3. Le parent est prévenu : l'alerte de ce signalement n'a plus lieu d'être
            await tx.adminAlert.updateMany({
                where: { type: `absence:${absence.id}`, read: false },
                data: { read: true, readAt: new Date() }
            });

            return result;
        });

        return NextResponse.json({ success: true, absence: updated });
    } catch (error) {
        console.error("Error validating absence:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de l'envoi" }, { status: 500 });
    }
}
// Envoi de la journée d'absence : une seule notification par élève et par jour.
async function envoyerJournee(p: {
    absenceId: number;
    studentId: number;
    parentId: number | null;
    date: Date;
    nomEleve: string;
    prenom: string | null;
    nameuser: string;
}) {
    const dateFr = p.date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });

    const tenter = () => prisma.$transaction(async (tx) => {
        // Parent déjà prévenu pour ce jour : on rattache, sans notifier de nouveau
        const rattachees = await rattacherAuPrevenu(tx, p.studentId, p.date);
        if (rattachees.length > 0 || await tx.parentAbsenceNotice.findUnique({
            where: { studentId_date: { studentId: p.studentId, date: p.date } },
        })) {
            await tx.activity.create({
                data: {
                    nameUser: p.nameuser,
                    description: `a rattaché l'absence de ${p.nomEleve} du ${dateFr} à la notification déjà envoyée au parent ce jour-là.`,
                }
            });
            return { dejaPrevenu: true };
        }

        // Premier envoi du jour : un message qui résume la journée
        const [absences, billet] = await Promise.all([
            tx.absence.findMany({
                where: { studentId: p.studentId, dateAbsence: p.date, status: "absence" },
                select: { id: true, hour: true },
                orderBy: { hour: 'asc' },
            }),
            tx.billet.findFirst({
                where: { studentId: p.studentId, date: p.date, type: "entree", statut: { not: "non_arrive" } },
                orderBy: { createdAt: 'desc' },
                select: { hour: true },
            }),
        ]);

        let corps = `Votre ${enfant(p.prenom)} a été marqué(e) absent(e) le ${dateFr} à partir de ${absences[0]?.hour || ""}.`;
        if (billet) {
            corps += billet.hour
                ? ` Il/elle est arrivé(e) à l'école avec un billet d'entrée délivré par l'administration (cours de ${billet.hour}).`
                : " Un billet d'entrée a été délivré par l'administration.";
        }

        const notification = p.parentId
            ? await tx.notification.create({
                data: { parentId: p.parentId, title: "Nouvelle absence", message: corps, type: "absence" }
            })
            : null;

        // La contrainte unique (élève, jour) empêche un second envoi concurrent
        const prevenu = await tx.parentAbsenceNotice.create({
            data: { studentId: p.studentId, date: p.date, notificationId: notification?.id ?? null, sentBy: p.nameuser }
        });

        const ids = absences.map(a => a.id);
        await tx.absence.updateMany({
            where: { id: { in: ids }, parentNoticeId: null },
            data: { parentNoticeId: prevenu.id, validated: true, validatedAt: new Date() },
        });
        await tx.adminAlert.updateMany({
            where: { type: { in: ids.map(id => `absence:${id}`) }, read: false },
            data: { read: true, readAt: new Date() },
        });
        await tx.activity.create({
            data: {
                nameUser: p.nameuser,
                description: `a envoyé au parent l'absence de ${p.nomEleve} du ${dateFr}.`,
            }
        });
        return { dejaPrevenu: false };
    });

    let resultat;
    try {
        resultat = await tenter();
    } catch (error) {
        // Un autre envoi vient de passer pour ce jour : on rattache simplement
        if ((error as { code?: string })?.code !== 'P2002') throw error;
        resultat = await tenter();
    }

    const absence = await prisma.absence.findUnique({ where: { id: p.absenceId } });
    return NextResponse.json({ success: true, absence, ...resultat });
}
