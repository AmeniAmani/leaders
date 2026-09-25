// Tri des parents par nom de famille, commun au serveur et au navigateur
// (aucun import de Prisma ici).
//
// Un parent n'a qu'un nom complet (name1, « Prénom Nom »). Le nom de famille en est
// déduit : celui d'un de ses enfants quand le nom complet se termine par lui (seule
// façon de reconnaître un nom composé comme « Ben Alaya »), sinon le dernier mot.
// Un nom d'un seul mot n'a pas de nom de famille : ces parents vont en fin de liste.
// Le tri se fait en JavaScript : la base est en collation C.UTF-8.

type ParentTri = {
    name1?: string | null;
    childrenIds?: { lastName?: string | null }[];
};

// Espaces en trop retirés
const propre = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

// Français, sans tenir compte de la casse ni des accents
const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

// Nom de famille déduit du nom complet ; null pour un nom d'un seul mot (ou vide)
export function nomDeFamille(p: ParentTri): string | null {
    const complet = propre(p.name1);
    const mots = complet.split(" ").filter(Boolean);
    if (mots.length < 2) return null;

    const bas = complet.toLocaleLowerCase("fr");
    const nomEnfant = (p.childrenIds || [])
        .map(e => propre(e.lastName))
        .filter(n => n && bas.endsWith(" " + n.toLocaleLowerCase("fr")))
        .sort((a, b) => b.length - a.length)[0];

    return nomEnfant ? complet.slice(complet.length - nomEnfant.length) : mots[mots.length - 1];
}

// Par nom de famille, puis nom complet ; les noms d'un seul mot à la fin
export function comparerParents(a: ParentTri, b: ParentTri) {
    const na = nomDeFamille(a), nb = nomDeFamille(b);
    if (na === null && nb !== null) return 1;
    if (na !== null && nb === null) return -1;
    return (na !== null && nb !== null ? collator.compare(na, nb) : 0) ||
        collator.compare(propre(a.name1), propre(b.name1));
}

export const trierParents = <T extends ParentTri>(parents: T[]): T[] => [...parents].sort(comparerParents);
