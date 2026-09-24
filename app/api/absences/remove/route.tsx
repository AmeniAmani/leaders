import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';

// Suppression d'une absence par l'enseignant qui l'a saisie.
// L'administration est alertée, surtout si le parent avait déjà été prévenu.
// Un billet émis depuis ce signalement est annulé avec lui.
const libelleType = (statut: string | null, minutes: number | null) =>
    statut === "exclusion" ? "l'exclusion"
    : statut === "retard" ? (minutes ? `le retard de ${minutes} min` : "le retard")
    : "l'absence";

export async function POST(request: Request) {
    try {
        const { absenceId } = await request.json();

        if (!absenceId) {
            return NextResponse.json({ error: "absenceId requis" }, { status: 400 });
        }

        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");
        const userId = String(store.get('user-id')?.value || "");
        const nameuser = String(store.get('user-name')?.value || "Inconnu");

        const absence = await prisma.absence.findUnique({
            where: { id: Number(absenceId) },
            include: {
                student: { select: { firstName: true, lastName: true } },
                classe: { select: { name: true, level: true } },
                billet: { select: { id: true, type: true } },
            }
        });

        if (!absence) {
            return NextResponse.json({ error: "Absence introuvable" }, { status: 404 });
        }

        // Un enseignant ne peut retirer que les absences qu'il a lui-même saisies
        if (role !== 'admin') {
            if (!absence.teacherId || String(absence.teacherId) !== userId) {
                return NextResponse.json(
                    { error: "Vous ne pouvez retirer que les absences que vous avez saisies" },
                    { status: 403 }
                );
            }
        }

        const nomEleve = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : `élève ID ${absence.studentId}`;
        const prefix =
            absence.classe?.level === "1" ? "السابعة أساسي " :
            absence.classe?.level === "2" ? "الثامنة أساسي " :
            absence.classe?.level === "3" ? "التاسعة أساسي " : "";
        const nomClasse = prefix + (absence.classe?.name || "");
        const dateStr = absence.dateAbsence
            ? new Date(absence.dateAbsence).toLocaleDateString('fr-FR')
            : "";
        const creneau = absence.hourEnd
            ? `de ${absence.hour} à ${absence.hourEnd}`
            : `à ${absence.hour || ""}`;
        const dejaEnvoyee = absence.validated === true;
        const typeTexte = libelleType(absence.status, absence.lateMinutes);
        const billetTexte = absence.billet
            ? ` Le ${absence.billet.type === "retard" ? "billet de retard" : "billet d'entrée"} émis pour ce signalement a été annulé.`
            : "";

        await prisma.$transaction(async (tx) => {
            // Le billet part avec le signalement, ainsi que ses notifications aux enseignants
            if (absence.billet) {
                await tx.teacherNotification.deleteMany({ where: { billetId: absence.billet.id } });
                await tx.billet.delete({ where: { id: absence.billet.id } });
            }

            await tx.absence.delete({ where: { id: absence.id } });

            // L'alerte de ce signalement disparaît avec lui
            await tx.adminAlert.updateMany({
                where: { type: `absence:${absence.id}`, read: false },
                data: { read: true, readAt: new Date() }
            });

            // Alerte destinée à l'administration
            await tx.adminAlert.create({
                data: {
                    type: dejaEnvoyee ? "absence_supprimee_envoyee" : "absence_supprimee",
                    message: dejaEnvoyee
                        ? `${nameuser} a supprimé ${typeTexte} de ${nomEleve} (${nomClasse}) du ${dateStr} ${creneau}.${billetTexte} ` +
                          `⚠️ Le parent avait DÉJÀ été prévenu : la notification reste visible dans son application.`
                        : `${nameuser} a supprimé ${typeTexte} de ${nomEleve} (${nomClasse}) du ${dateStr} ${creneau}.${billetTexte} ` +
                          `Ce signalement n'avait pas encore été envoyé au parent.`,
                }
            });

            // Journal d'activité
            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a supprimé ${typeTexte} de ${nomEleve} du ${dateStr} ${creneau}.` +
                        (absence.billet ? " Billet annulé." : ""),
                }
            });
        });

        return NextResponse.json({ success: true, wasSent: dejaEnvoyee });
    } catch (error) {
        console.error("Erreur suppression absence:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la suppression" }, { status: 500 });
    }
}