import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { enMinutes, jourDe, maintenant } from '../../../../lib/emploi-du-temps';
import { chevauche, conflit, libelleClasse, libelleCreneau, nomSalle } from '../../../../lib/reservations';

// { action: "valider" | "refuser", motifRefus? } : administration.
// { action: "annuler" } : l'enseignant, pour sa propre demande à venir.
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const { action, motifRefus } = await request.json();

        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");
        const userId = Number(store.get('user-id')?.value);
        const nameuser = String(store.get('user-name')?.value || "Inconnu");

        const r = await prisma.roomReservation.findUnique({
            where: { id: Number(id) },
            include: {
                room: { select: { id: true, name: true } },
                teacher: { select: { id: true, name: true } },
                classe: { select: { name: true, level: true } },
            },
        });
        if (!r) {
            return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
        }

        const jour = jourDe(r.date);
        const debut = enMinutes(r.hour) ?? 0;
        const fin = debut + r.duration * 60;
        const creneau = libelleCreneau(r.date, r.hour, r.duration);
        const salle = nomSalle(r.room);
        const { date: aujourdhui, minutes } = maintenant();
        const passee = jour < aujourdhui || (jour === aujourdhui && debut <= minutes);

        if (action === "valider" || action === "refuser") {
            if (role !== 'admin') {
                return NextResponse.json({ error: "Seule l'administration traite les demandes" }, { status: 403 });
            }
            if (r.statut !== "en_attente") {
                return NextResponse.json({ error: "Cette demande a déjà été traitée" }, { status: 409 });
            }
            if (action === "valider" && passee) {
                return NextResponse.json({ error: "Ce créneau est déjà passé" }, { status: 400 });
            }
            const refus = typeof motifRefus === 'string' && motifRefus.trim() ? motifRefus.trim().slice(0, 200) : null;

            const resultat = await prisma.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${r.roomId} FOR UPDATE`;

                if (action === "valider") {
                    const probleme = await conflit(r.roomId, jour, debut, fin, r.id);
                    if (probleme) throw new ErreurMetier(probleme);
                }

                const { count } = await tx.roomReservation.updateMany({
                    where: { id: r.id, statut: "en_attente" },
                    data: {
                        statut: action === "valider" ? "validee" : "refusee",
                        motifRefus: action === "refuser" ? refus : null,
                        traiteAt: new Date(),
                        traitePar: nameuser,
                    },
                });
                if (count === 0) throw new ErreurMetier("Cette demande a déjà été traitée");

                await tx.teacherNotification.create({
                    data: {
                        teacherId: r.teacherId,
                        type: "reservation",
                        title: action === "valider" ? "Réservation validée" : "Réservation refusée",
                        message: action === "valider"
                            ? `Votre réservation de la ${salle} est validée : ${creneau}.`
                            : `Votre demande de la ${salle} (${creneau}) est refusée.${refus ? ` Motif : ${refus}` : ""}`,
                    },
                });

                // Les autres demandes en attente sur ce créneau ne peuvent plus être satisfaites
                const refusees: number[] = [];
                if (action === "valider") {
                    const autres = await tx.roomReservation.findMany({
                        where: { roomId: r.roomId, date: r.date, statut: "en_attente", id: { not: r.id } },
                    });
                    for (const a of autres) {
                        const d = enMinutes(a.hour) ?? 0;
                        if (!chevauche(debut, fin, d, d + a.duration * 60)) continue;
                        await tx.roomReservation.update({
                            where: { id: a.id },
                            data: {
                                statut: "refusee",
                                motifRefus: "Créneau attribué à une autre demande",
                                traiteAt: new Date(),
                                traitePar: nameuser,
                            },
                        });
                        await tx.teacherNotification.create({
                            data: {
                                teacherId: a.teacherId,
                                type: "reservation",
                                title: "Réservation refusée",
                                message: `Votre demande de la ${salle} (${libelleCreneau(a.date, a.hour, a.duration)}) est refusée : créneau attribué à une autre demande.`,
                            },
                        });
                        refusees.push(a.id);
                    }
                }

                // L'alerte de ces demandes a reçu sa réponse
                await tx.adminAlert.updateMany({
                    where: { type: { in: [r.id, ...refusees].map(x => `reservation:${x}`) }, read: false },
                    data: { read: true, readAt: new Date() },
                });

                await tx.activity.create({
                    data: {
                        nameUser: nameuser,
                        description: `a ${action === "valider" ? "validé" : "refusé"} la réservation de la ${salle} ` +
                            `par ${r.teacher.name || "un enseignant"} (${libelleClasse(r.classe)}) : ${creneau}.`,
                    },
                });
                return { refusees: refusees.length };
            });

            return NextResponse.json({ success: true, ...resultat });
        }

        if (action === "annuler") {
            if (role !== 'prof' || r.teacherId !== userId) {
                return NextResponse.json({ error: "Vous ne pouvez annuler que vos propres demandes" }, { status: 403 });
            }
            if (r.statut !== "en_attente" && r.statut !== "validee") {
                return NextResponse.json({ error: "Cette demande ne peut plus être annulée" }, { status: 409 });
            }
            if (passee) {
                return NextResponse.json({ error: "Ce créneau est déjà passé" }, { status: 400 });
            }
            const etaitValidee = r.statut === "validee";

            await prisma.$transaction(async (tx) => {
                const { count } = await tx.roomReservation.updateMany({
                    where: { id: r.id, statut: r.statut },
                    data: { statut: "annulee", traiteAt: new Date(), traitePar: nameuser },
                });
                if (count === 0) throw new ErreurMetier("Cette demande vient d'être traitée : rechargez la page");

                await tx.adminAlert.updateMany({
                    where: { type: `reservation:${r.id}`, read: false },
                    data: { read: true, readAt: new Date() },
                });
                // Une réservation confirmée qui se libère : l'administration est prévenue
                if (etaitValidee) {
                    await tx.adminAlert.create({
                        data: {
                            type: `reservation_annulee:${r.id}`,
                            message: `${r.teacher.name || nameuser} a annulé sa réservation de la ${salle} (${libelleClasse(r.classe)}) : ${creneau}. Le créneau est libre.`,
                        },
                    });
                }
                await tx.activity.create({
                    data: { nameUser: nameuser, description: `a annulé sa ${etaitValidee ? "réservation" : "demande"} de la ${salle} : ${creneau}.` },
                });
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    } catch (error) {
        if (error instanceof ErreurMetier) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        console.error("Erreur traitement réservation:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}

class ErreurMetier extends Error {}
