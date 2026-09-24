import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server';
import { dateDuJour, enHeure, enMinutes, maintenant } from '../../../lib/emploi-du-temps';
import {
    FIN_JOURNEE, HEURES_RESERVATION, SEMAINES_A_L_AVANCE, STATUTS_ACTIFS,
    ajouterJours, chevauche, classesDeLEnseignant, conflit, coursDansLaSalle,
    joursDeLaSemaine, libelleClasse, libelleCreneau, lundiDe, nomSalle, salleCinema,
} from '../../../lib/reservations';

export const dynamic = 'force-dynamic';

const INCLUDE = {
    teacher: { select: { id: true, name: true } },
    classe: { select: { id: true, name: true, level: true } },
} as const;

type Ligne = Awaited<ReturnType<typeof prisma.roomReservation.findMany<{ include: typeof INCLUDE }>>>[number];

const enClair = (r: Ligne) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    hour: r.hour,
    hourEnd: enHeure((enMinutes(r.hour) ?? 0) + r.duration * 60),
    duration: r.duration,
    motif: r.motif,
    statut: r.statut,
    motifRefus: r.motifRefus,
    traiteAt: r.traiteAt,
    traitePar: r.traitePar,
    createdAt: r.createdAt,
    teacherId: r.teacherId,
    enseignant: r.teacher.name,
    classId: r.classId,
    classe: libelleClasse(r.classe),
});

// Semaine de la salle de cinéma : cours de l'emploi du temps, réservations (validées
// et en attente), et la liste des demandes (toutes pour l'administration, les siennes
// pour un enseignant). ?semaine=AAAA-MM-JJ (n'importe quel jour de la semaine voulue).
export async function GET(request: Request) {
    try {
        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");
        const userId = Number(store.get('user-id')?.value);
        const estAdmin = role === 'admin';

        // ?compte=1 : seulement le nombre de demandes en attente (pastille de la barre latérale)
        if (new URL(request.url).searchParams.get('compte')) {
            if (!estAdmin) return NextResponse.json({ enAttente: 0 });
            return NextResponse.json({ enAttente: await prisma.roomReservation.count({ where: { statut: "en_attente" } }) });
        }

        const salle = await salleCinema();
        if (!salle) {
            return NextResponse.json({ error: "Salle de cinéma introuvable" }, { status: 404 });
        }

        const { date: aujourdhui, minutes } = maintenant();
        const demandee = new URL(request.url).searchParams.get('semaine');
        const lundi = lundiDe(/^\d{4}-\d{2}-\d{2}$/.test(demandee || "") ? demandee! : aujourdhui);
        const jours = joursDeLaSemaine(lundi);

        const [cours, reservations, demandes, enAttente] = await Promise.all([
            Promise.all(jours.map(j => coursDansLaSalle(salle.id, j))).then(l => l.flat()),
            prisma.roomReservation.findMany({
                where: {
                    roomId: salle.id,
                    date: { gte: dateDuJour(lundi), lt: dateDuJour(ajouterJours(lundi, 5)) },
                    statut: { in: STATUTS_ACTIFS },
                },
                include: INCLUDE,
                orderBy: [{ date: 'asc' }, { hour: 'asc' }],
            }),
            prisma.roomReservation.findMany({
                where: estAdmin
                    // En attente : toutes ; traitées : les 30 derniers jours
                    ? { roomId: salle.id, OR: [{ statut: "en_attente" }, { date: { gte: dateDuJour(ajouterJours(aujourdhui, -30)) } }] }
                    : { roomId: salle.id, teacherId: userId || -1, date: { gte: dateDuJour(ajouterJours(aujourdhui, -30)) } },
                include: INCLUDE,
                orderBy: [{ date: 'asc' }, { hour: 'asc' }],
                take: 200,
            }),
            prisma.roomReservation.count({ where: { roomId: salle.id, statut: "en_attente" } }),
        ]);

        return NextResponse.json({
            salle: { id: salle.id, name: nomSalle(salle) },
            aujourdhui,
            minutes,
            lundi,
            lundiActuel: lundiDe(aujourdhui),
            semainesALAvance: SEMAINES_A_L_AVANCE,
            jours,
            heures: HEURES_RESERVATION,
            cours,
            reservations: reservations.map(enClair),
            demandes: demandes.map(enClair),
            enAttente,
        });
    } catch (error) {
        console.error("Erreur lecture réservations:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}

// Demande de réservation par un enseignant : { date, hour, duration, classId, motif }
export async function POST(request: Request) {
    try {
        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");
        const teacherId = Number(store.get('user-id')?.value);
        const nameuser = String(store.get('user-name')?.value || "Inconnu");

        if (role !== 'prof' || !teacherId) {
            return NextResponse.json({ error: "Seul un enseignant peut demander une réservation" }, { status: 403 });
        }

        const json = await request.json();
        const date = String(json.date || "");
        const hour = String(json.hour || "");
        const duration = Number(json.duration);
        const classId = Number(json.classId);
        const motif = typeof json.motif === 'string' && json.motif.trim() ? json.motif.trim().slice(0, 200) : null;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !HEURES_RESERVATION.includes(hour) || ![1, 2].includes(duration)) {
            return NextResponse.json({ error: "Choisissez une ou deux heures dans la grille" }, { status: 400 });
        }
        const debut = enMinutes(hour)!;
        const fin = debut + duration * 60;
        if (fin > FIN_JOURNEE) {
            return NextResponse.json({ error: "La réservation doit se terminer avant 18:00" }, { status: 400 });
        }
        const jourSemaine = new Date(date).getUTCDay();
        if (jourSemaine === 0 || jourSemaine === 6) {
            return NextResponse.json({ error: "La salle se réserve du lundi au vendredi" }, { status: 400 });
        }
        const { date: aujourdhui, minutes } = maintenant();
        if (date < aujourdhui || (date === aujourdhui && debut < minutes)) {
            return NextResponse.json({ error: "Ce créneau est déjà passé" }, { status: 400 });
        }
        if (lundiDe(date) > ajouterJours(lundiDe(aujourdhui), SEMAINES_A_L_AVANCE * 7)) {
            return NextResponse.json({ error: `On réserve au plus ${SEMAINES_A_L_AVANCE} semaines à l'avance` }, { status: 400 });
        }

        if (!classId || !(await classesDeLEnseignant(teacherId)).includes(classId)) {
            return NextResponse.json({ error: "Choisissez une de vos classes" }, { status: 400 });
        }

        const salle = await salleCinema();
        if (!salle) {
            return NextResponse.json({ error: "Salle de cinéma introuvable" }, { status: 404 });
        }

        const probleme = await conflit(salle.id, date, debut, fin);
        if (probleme) {
            return NextResponse.json({ error: probleme }, { status: 409 });
        }

        const creee = await prisma.$transaction(async (tx) => {
            // Une demande à la fois par salle : sérialise les clics simultanés
            await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${salle.id} FOR UPDATE`;

            // Pas deux demandes du même enseignant qui se chevauchent
            const siennes = await tx.roomReservation.findMany({
                where: { roomId: salle.id, teacherId, date: dateDuJour(date), statut: { in: STATUTS_ACTIFS } },
            });
            if (siennes.some(r => chevauche(debut, fin, enMinutes(r.hour) ?? 0, (enMinutes(r.hour) ?? 0) + r.duration * 60))) {
                throw new ErreurMetier("Vous avez déjà une demande sur ce créneau");
            }

            const r = await tx.roomReservation.create({
                data: { roomId: salle.id, teacherId, classId, date: dateDuJour(date), hour, duration, motif },
                include: INCLUDE,
            });

            const creneau = libelleCreneau(r.date, hour, duration);
            await tx.adminAlert.create({
                data: {
                    type: `reservation:${r.id}`,
                    message: `${r.teacher.name || nameuser} demande la ${nomSalle(salle)} ` +
                        `(${libelleClasse(r.classe)}) : ${creneau}.${motif ? ` Motif : ${motif}` : ""}`,
                },
            });
            await tx.activity.create({
                data: { nameUser: nameuser, description: `a demandé la ${nomSalle(salle)} : ${creneau}.` },
            });
            return r;
        });

        return NextResponse.json({ success: true, reservation: enClair(creee) });
    } catch (error) {
        if (error instanceof ErreurMetier) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        console.error("Erreur demande de réservation:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}

class ErreurMetier extends Error {}
