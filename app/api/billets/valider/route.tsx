import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { isoler } from '../../../../lib/bidi';
import { NextResponse } from 'next/server';

// L'enseignant du cours où l'élève se présente avec son billet d'entrée :
// - arrive: true  -> arrivée validée, la présence est enregistrée ;
// - arrive: false -> élève non arrivé : le billet ne compte plus (l'élève redevient
//   « encore absent » sur ce créneau) et l'administration est alertée.
// Seuls les enseignants qui ont reçu le billet, et l'administration, peuvent le traiter.
export async function POST(request: Request) {
    try {
        const { billetId, arrive } = await request.json();

        if (!billetId || typeof arrive !== "boolean") {
            return NextResponse.json({ error: "billetId et arrive requis" }, { status: 400 });
        }

        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");
        const userId = Number(store.get('user-id')?.value);
        const nameuser = String(store.get('user-name')?.value || "Inconnu");

        const billet = await prisma.billet.findUnique({
            where: { id: Number(billetId) },
            include: {
                student: { select: { firstName: true, lastName: true } },
                classe: { select: { name: true, level: true } },
                notifications: { select: { teacherId: true } },
            },
        });
        if (!billet || billet.type !== "entree") {
            return NextResponse.json({ error: "Billet d'entrée introuvable" }, { status: 404 });
        }

        if (role !== 'admin' && !billet.notifications.some(n => n.teacherId === userId)) {
            return NextResponse.json({ error: "Ce billet ne vous a pas été adressé" }, { status: 403 });
        }

        const nomEleve = `${billet.student.firstName || ''} ${billet.student.lastName || ''}`.trim();
        const prefix =
            billet.classe.level === "1" ? "السابعة أساسي " :
            billet.classe.level === "2" ? "الثامنة أساسي " :
            billet.classe.level === "3" ? "التاسعة أساسي " : "";
        const nomClasse = isoler(prefix + billet.classe.name);
        const cours = billet.hour ? `au cours de ${billet.hour}` : "";
        const statut = arrive ? "valide" : "non_arrive";

        const traite = await prisma.$transaction(async (tx) => {
            // Un billet n'est traité qu'une fois, même si deux enseignants cliquent ensemble
            const { count } = await tx.billet.updateMany({
                where: { id: billet.id, statut: "en_attente" },
                data: { statut, traiteAt: new Date(), traitePar: nameuser },
            });
            if (count === 0) return null;

            // La notification disparaît chez tous les enseignants qui l'ont reçue
            await tx.teacherNotification.updateMany({
                where: { billetId: billet.id, read: false },
                data: { read: true, readAt: new Date() },
            });

            if (!arrive) {
                await tx.adminAlert.create({
                    data: {
                        type: `billet_non_arrive:${billet.id}`,
                        message: `${nameuser} signale que ${nomEleve} (${nomClasse}) ne s'est pas présenté(e) ${cours} ` +
                            `malgré le billet d'entrée émis par ${billet.createdBy}.`,
                    },
                });
            }

            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: arrive
                        ? `a validé l'arrivée de ${nomEleve} avec un billet d'entrée ${cours}.`
                        : `a signalé que ${nomEleve} ne s'est pas présenté(e) ${cours} malgré le billet d'entrée.`,
                },
            });

            return tx.billet.findUnique({
                where: { id: billet.id },
                select: { id: true, statut: true, traiteAt: true, traitePar: true },
            });
        });

        if (!traite) {
            const actuel = await prisma.billet.findUnique({
                where: { id: billet.id },
                select: { statut: true, traitePar: true },
            });
            return NextResponse.json(
                {
                    error: actuel?.statut === "valide"
                        ? `L'arrivée a déjà été validée${actuel.traitePar ? ` par ${actuel.traitePar}` : ""}.`
                        : `Ce billet a déjà été signalé « non arrivé »${actuel?.traitePar ? ` par ${actuel.traitePar}` : ""}.`,
                },
                { status: 409 }
            );
        }

        return NextResponse.json({ success: true, billet: traite });
    } catch (error) {
        console.error("Erreur validation billet:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}
