import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { notifyParentsOfStudent } from '../../../../lib/notifications';

// Envoie une absence au parent, puis la marque comme validée.
// Réservé à l'administration.
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
                student: { select: { id: true, firstName: true, lastName: true } }
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

        const formattedDate = absence.dateAbsence
            ? new Date(absence.dateAbsence).toLocaleDateString('fr-FR')
            : "";

        // Message adapté au type de signalement
        const creneau = absence.hourEnd
            ? `de ${absence.hour} à ${absence.hourEnd}`
            : `à ${absence.hour || ""}`;

        let titre = "Nouvelle absence";
        let corps = `Votre enfant a été marqué absent le ${formattedDate} ${creneau}.`;

        if (absence.status === "exclusion") {
            titre = "Exclusion de cours";
            corps = `Votre enfant a été exclu du cours le ${formattedDate} ${creneau}.`;
        } else if (absence.status === "retard") {
            titre = "Retard";
            corps = absence.lateMinutes
                ? `Votre enfant est arrivé avec ${absence.lateMinutes} minutes de retard le ${formattedDate}, au cours ${creneau}.`
                : `Votre enfant est arrivé en retard le ${formattedDate}, au cours ${creneau}.`;
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