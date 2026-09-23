import prisma from './prisma';

// Tout ce qui dépend de l'emploi du temps et de l'heure est lu ici, à chaque
// appel : rien n'est figé, un changement d'emploi du temps s'applique aussitôt.

// Le serveur tourne en UTC : l'heure de l'école se calcule explicitement.
const FUSEAU = 'Africa/Tunis';
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Premier jour d'une semaine A. Modifiable une fois par an depuis les réglages.
export const CLE_REFERENCE_SEMAINE_A = 'semaine_a_reference';
export const REFERENCE_SEMAINE_A_DEFAUT = '2026-09-15';

// "08:30" -> 510 (minutes depuis minuit)
export const enMinutes = (h: string | null | undefined): number | null => {
    if (!h) return null;
    const [hh, mm] = h.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;
    return hh * 60 + mm;
};

// 510 -> "08:30"
export const enHeure = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// La feuille d'appel se saisit par heure pleine : 10:40 -> créneau 10:00-11:00
export const creneauDe = (minutes: number) => {
    const debut = Math.floor(minutes / 60) * 60;
    return { hour: enHeure(debut), hourEnd: enHeure(debut + 60) };
};

// Date et heure actuelles à l'école
export function maintenant() {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: FUSEAU,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(new Date()).map(p => [p.type, p.value])
    );
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
}

// "2026-09-23" -> Date à minuit UTC, le format de Absence.dateAbsence
export const dateDuJour = (jour: string) => new Date(jour);

// Date de la base -> "2026-09-23"
export const jourDe = (d: Date) => d.toISOString().slice(0, 10);

export const jourSemaine = (jour: string) => JOURS[new Date(jour).getUTCDay()];

// Rentrée en septembre
export function anneeScolaire(jour: string) {
    const d = new Date(jour);
    const y = d.getUTCFullYear();
    return d.getUTCMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

// Lundi de la semaine contenant ce jour, en jours depuis l'époque
const lundiDe = (jour: string) => {
    const d = new Date(jour);
    const decalage = (d.getUTCDay() + 6) % 7; // lundi = 0
    return Math.floor(d.getTime() / 86400000) - decalage;
};

export async function referenceSemaineA() {
    const reglage = await prisma.globalSetting.findUnique({ where: { key: CLE_REFERENCE_SEMAINE_A } });
    return reglage?.value || REFERENCE_SEMAINE_A_DEFAUT;
}

// Alternance simple semaine après semaine depuis la référence (vacances ignorées)
export function semaineAB(jour: string, reference: string): "A" | "B" {
    const ecart = Math.round((lundiDe(jour) - lundiDe(reference)) / 7);
    return ecart % 2 === 0 ? "A" : "B";
}

export type Cours = Awaited<ReturnType<typeof coursDuJour>>[number];

// Cours d'une journée, pour une classe ou un enseignant, en tenant compte de
// l'année scolaire et de la semaine A/B. Les doublons exacts sont écartés.
export async function coursDuJour(filtre: { jour: string; classId?: number; teacherId?: number }) {
    const semaine = semaineAB(filtre.jour, await referenceSemaineA());
    const lignes = await prisma.schedule.findMany({
        where: {
            as: anneeScolaire(filtre.jour),
            day: jourSemaine(filtre.jour),
            OR: [{ week: "all" }, { week: null }, { week: semaine }],
            ...(filtre.classId ? { classId: filtre.classId } : {}),
            ...(filtre.teacherId ? { teacherId: filtre.teacherId } : {}),
        },
        include: {
            teacher: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
            class: { select: { id: true, name: true, level: true } },
        },
        orderBy: { start: 'asc' },
    });

    const vus = new Set<string>();
    return lignes
        .map(s => {
            const debut = enMinutes(s.start);
            return debut === null ? null : { ...s, debut, fin: debut + Math.round((s.duration || 1) * 60) };
        })
        .filter((s): s is NonNullable<typeof s> => {
            if (!s) return false;
            const cle = `${s.classId}-${s.teacherId}-${s.subjectId}-${s.debut}-${s.fin}`;
            if (vus.has(cle)) return false;
            vus.add(cle);
            return true;
        });
}

// Cours en train de se dérouler à cette minute
export const coursA = <T extends { debut: number; fin: number }>(cours: T[], minutes: number) =>
    cours.filter(c => c.debut <= minutes && minutes < c.fin);

// Cours qui couvrent un créneau d'une heure de la feuille d'appel
export const coursSurCreneau = <T extends { debut: number; fin: number }>(cours: T[], hour: string) => {
    const d = enMinutes(hour);
    if (d === null) return [];
    return cours.filter(c => c.debut < d + 60 && c.fin > d);
};

// Enseignants distincts d'une liste de cours
export const enseignantsDe = (cours: { teacherId: number | null }[]) =>
    Array.from(new Set(cours.map(c => c.teacherId).filter((id): id is number => id !== null)));

// ----- État d'un élève sur un créneau de la feuille d'appel -----

export type EtatAppel = "encore_absent" | "present_avec_billet" | "billet_retard";

// Pour chaque élève d'une classe, sur le créneau `hour` du jour `jour` :
// - "encore_absent"       : absent sur un créneau précédent, sans billet d'entrée depuis ;
// - "present_avec_billet" : billet d'entrée émis pour ce créneau ;
// - "billet_retard"       : billet de retard émis pour le retard saisi sur ce créneau.
// Un élève absent de la liste est simplement présent (y compris après un billet).
export async function etatsAppel(classId: number, jour: string, hour: string) {
    const h = enMinutes(hour);
    const etats: Record<number, EtatAppel> = {};
    if (h === null) return etats;

    const date = dateDuJour(jour);
    const eleves = await prisma.student.findMany({ where: { classId }, select: { id: true } });
    const ids = eleves.map(e => e.id);
    if (ids.length === 0) return etats;

    const [absences, billets] = await Promise.all([
        prisma.absence.findMany({
            where: { studentId: { in: ids }, dateAbsence: date, status: "absence" },
            select: { studentId: true, hour: true },
        }),
        prisma.billet.findMany({
            where: { studentId: { in: ids }, date },
            select: { studentId: true, type: true, hour: true },
        }),
    ]);

    for (const id of ids) {
        // Dernière absence saisie avant ce créneau
        const derniereAbsence = Math.max(-1, ...absences
            .filter(a => a.studentId === id)
            .map(a => enMinutes(a.hour) ?? -1)
            .filter(m => m < h));

        // Dernier billet d'entrée valable jusqu'à ce créneau inclus
        const entrees = billets.filter(b => b.studentId === id && b.type === "entree" && b.hour !== null);
        const dernierBillet = Math.max(-1, ...entrees
            .map(b => enMinutes(b.hour) ?? -1)
            .filter(m => m <= h));

        // Un billet couvre les absences saisies jusqu'à son propre créneau
        if (dernierBillet === h) {
            etats[id] = "present_avec_billet";
        } else if (derniereAbsence >= 0 && derniereAbsence > dernierBillet) {
            etats[id] = "encore_absent";
        }

        // Le billet de retard ne vaut que sur son propre créneau
        if (billets.some(b => b.studentId === id && b.type === "retard" && b.hour === hour)) {
            etats[id] = "billet_retard";
        }
    }
    return etats;
}
