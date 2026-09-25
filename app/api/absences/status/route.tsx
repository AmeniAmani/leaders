import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { isoler } from '../../../../lib/bidi';
import { NextResponse } from 'next/server';
import { rattacherAuPrevenu } from '../../../../lib/absences-parent';

const STATUTS = ["absence", "exclusion", "retard"];

const libelle = (statut: string | null, minutes: number | null) =>
    statut === "exclusion" ? "exclusion"
    : statut === "retard" ? (minutes ? `retard de ${minutes} min` : "retard")
    : "absence";

// Modification du type d'un signalement par l'enseignant qui l'a saisi.
// L'administration est alertée, surtout si le parent avait déjà été prévenu.
export async function POST(request: Request) {
    try {
        const { absenceId, status, lateMinutes } = await request.json();

        if (!absenceId) {
            return NextResponse.json({ error: "absenceId requis" }, { status: 400 });
        }
        if (!STATUTS.includes(status)) {
            return NextResponse.json({ error: "Type de signalement invalide" }, { status: 400 });
        }

        const minutes = status === "retard" ? Number(lateMinutes) : null;
        if (status === "retard" && (!Number.isInteger(minutes) || (minutes as number) < 1 || (minutes as number) > 240)) {
            return NextResponse.json({ error: "Les minutes de retard doivent être un nombre entier entre 1 et 240" }, { status: 400 });
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
                billet: { select: { id: true } },
            }
        });

        if (!absence) {
            return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 });
        }

        // Un enseignant ne peut modifier que les signalements qu'il a saisis
        if (role !== 'admin') {
            if (!absence.teacherId || String(absence.teacherId) !== userId) {
                return NextResponse.json(
                    { error: "Vous ne pouvez modifier que les signalements que vous avez saisis" },
                    { status: 403 }
                );
            }
        }

        const ancien = libelle(absence.status, absence.lateMinutes);
        const nouveau = libelle(status, minutes);

        // Rien n'a changé
        if (absence.status === status && (absence.lateMinutes ?? null) === minutes) {
            return NextResponse.json({ success: true, absence, unchanged: true });
        }

        // Un billet a été émis depuis ce signalement : il reste au registre
        if (absence.billet) {
            return NextResponse.json(
                { error: "Un billet a été émis pour ce signalement : il ne peut plus être modifié ni supprimé" },
                { status: 409 }
            );
        }

        const nomEleve = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : `élève ID ${absence.studentId}`;
        const prefix =
            absence.classe?.level === "1" ? "السابعة أساسي " :
            absence.classe?.level === "2" ? "الثامنة أساسي " :
            absence.classe?.level === "3" ? "التاسعة أساسي " : "";
        const nomClasse = isoler(prefix + (absence.classe?.name || ""));
        const dateStr = absence.dateAbsence
            ? new Date(absence.dateAbsence).toLocaleDateString('fr-FR')
            : "";
        const creneau = absence.hourEnd
            ? `de ${absence.hour} à ${absence.hourEnd}`
            : `à ${absence.hour || ""}`;
        const dejaEnvoyee = absence.validated === true;

        const mis = await prisma.$transaction(async (tx) => {
            const resultat = await tx.absence.update({
                where: { id: absence.id },
                data: { status, lateMinutes: minutes }
            });

            // Devenue une absence alors que le parent est déjà prévenu ce jour-là
            if (status === "absence" && !dejaEnvoyee && absence.studentId && absence.dateAbsence) {
                await rattacherAuPrevenu(tx, absence.studentId, absence.dateAbsence);
            }

            // Alerte destinée à l'administration
            await tx.adminAlert.create({
                data: {
                    type: dejaEnvoyee ? "signalement_modifie_envoye" : "signalement_modifie",
                    message: dejaEnvoyee
                        ? `${nameuser} a modifié le signalement de ${nomEleve} (${nomClasse}) du ${dateStr} ${creneau} : ` +
                          `${ancien} → ${nouveau}. ⚠️ Le parent avait DÉJÀ été prévenu de l'ancien motif.`
                        : `${nameuser} a modifié le signalement de ${nomEleve} (${nomClasse}) du ${dateStr} ${creneau} : ` +
                          `${ancien} → ${nouveau}. Il n'avait pas encore été envoyé au parent.`,
                }
            });

            // Journal d'activité
            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a modifié le signalement de ${nomEleve} du ${dateStr} ${creneau} : ${ancien} → ${nouveau}.`,
                }
            });

            return resultat;
        });

        return NextResponse.json({ success: true, absence: mis, wasSent: dejaEnvoyee });
    } catch (error) {
        console.error("Erreur modification signalement:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la modification" }, { status: 500 });
    }
}