import { isoler } from './bidi';
import prisma from './prisma';
import { anneeScolaire, coursDuJour, dateDuJour, enHeure, enMinutes, jourDe, maintenant } from './emploi-du-temps';

// Réservation de la salle de cinéma : grille du lundi au vendredi, de 8h à 18h,
// par heure pleine ; 1 ou 2 heures consécutives par demande.
export const HEURES_RESERVATION = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
export const FIN_JOURNEE = 18 * 60;
export const SEMAINES_A_L_AVANCE = 12;

// Une réservation qui occupe la salle : validée, ou demandée et pas encore traitée
export const STATUTS_ACTIFS = ["en_attente", "validee"];

// La salle de cinéma, retrouvée par son nom (« Salle de Cinéma »)
export function salleCinema() {
    return prisma.room.findFirst({
        where: {
            OR: [
                { name: { contains: 'cinéma', mode: 'insensitive' } },
                { name: { contains: 'cinema', mode: 'insensitive' } },
            ],
        },
        orderBy: { id: 'asc' },
    });
}

// Nom affiché de la salle (sans espaces parasites)
export const nomSalle = (salle: { name: string | null }) => (salle.name || "").trim() || "salle de cinéma";

// Lundi de la semaine qui contient ce jour : "2026-10-01" -> "2026-09-28"
export function lundiDe(jour: string) {
    const d = new Date(jour);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return jourDe(d);
}

export function ajouterJours(jour: string, n: number) {
    const d = new Date(jour);
    d.setUTCDate(d.getUTCDate() + n);
    return jourDe(d);
}

// Les cinq jours de classe de la semaine
export const joursDeLaSemaine = (lundi: string) => [0, 1, 2, 3, 4].map(i => ajouterJours(lundi, i));

// Libellé d'une classe, comme dans le reste de l'application
export const libelleClasse = (c?: { level: string | null; name: string | null } | null) =>
    !c ? "" :
    (c.level === "1" ? "السابعة أساسي " :
     c.level === "2" ? "الثامنة أساسي " :
     c.level === "3" ? "التاسعة أساسي " : "") + (c.name || "");

// Classes d'un enseignant : celles que l'administration lui a affectées ; à défaut,
// celles de son emploi du temps (même règle que /api/classes/teacher/<id>).
export async function classesDeLEnseignant(teacherId: number) {
    const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { subjectId: true, classes: { select: { id: true } } },
    });
    if (!teacher) return [];
    if (teacher.classes.length > 0) return teacher.classes.map(c => c.id);
    const schedules = await prisma.schedule.findMany({
        where: { teacherId, subjectId: teacher.subjectId, as: anneeScolaire(maintenant().date) },
        select: { classId: true },
    });
    return Array.from(new Set(schedules.map(s => s.classId).filter((id): id is number => id !== null)));
}

export const chevauche = (debutA: number, finA: number, debutB: number, finB: number) =>
    debutA < finB && debutB < finA;

// Cours de l'emploi du temps qui ont lieu dans la salle ce jour-là (semaine A/B comprise)
export async function coursDansLaSalle(roomId: number, jour: string) {
    const cours = await coursDuJour({ jour, roomId });
    return cours.map(c => ({
        jour,
        debut: c.debut,
        fin: c.fin,
        classe: libelleClasse(c.class),
        matiere: c.subject?.name || null,
        enseignant: c.teacher?.name || null,
    }));
}

// Ce qui empêche d'occuper la salle sur ce créneau : un cours de l'emploi du temps
// ou une réservation validée (hors la réservation `saufId`). Renvoie un message, ou null.
export async function conflit(
    roomId: number, jour: string, debut: number, fin: number, saufId?: number,
): Promise<string | null> {
    const cours = await coursDansLaSalle(roomId, jour);
    const c = cours.find(x => chevauche(debut, fin, x.debut, x.fin));
    if (c) return `La salle est occupée par un cours (${isoler(c.classe)}${c.matiere ? `, ${isoler(c.matiere)}` : ""}) de ${enHeure(c.debut)} à ${enHeure(c.fin)}.`;

    const validees = await prisma.roomReservation.findMany({
        where: { roomId, date: dateDuJour(jour), statut: "validee", ...(saufId ? { id: { not: saufId } } : {}) },
        include: { teacher: { select: { name: true } } },
    });
    const r = validees.find(v => {
        const d = enMinutes(v.hour) ?? 0;
        return chevauche(debut, fin, d, d + v.duration * 60);
    });
    if (r) return `La salle est déjà réservée par ${r.teacher.name || "un enseignant"} de ${r.hour} à ${enHeure((enMinutes(r.hour) ?? 0) + r.duration * 60)}.`;
    return null;
}

// "Jeudi 01/10/2026 de 10:00 à 12:00"
export function libelleCreneau(date: Date, hour: string, duration: number) {
    const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
    const fin = enHeure((enMinutes(hour) ?? 0) + duration * 60);
    return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} de ${hour} à ${fin}`;
}
