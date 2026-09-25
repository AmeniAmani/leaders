// Tri des élèves, commun au serveur et au navigateur
// (aucun import de Prisma ici).
//
// Le tri se fait en JavaScript et non en SQL : la base est en collation C.UTF-8,
// qui range les minuscules après le Z et les lettres accentuées à la fin.

type NomEleve = { firstName?: string | null; lastName?: string | null };

// Espaces en trop retirés : "Adem " -> "Adem"
const propre = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

// Français, sans tenir compte de la casse ni des accents
const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

// Par nom, puis par prénom
export const comparerEleves = (a: NomEleve, b: NomEleve) =>
    collator.compare(propre(a.lastName), propre(b.lastName)) ||
    collator.compare(propre(a.firstName), propre(b.firstName));

export const trierEleves = <T extends NomEleve>(eleves: T[]): T[] => [...eleves].sort(comparerEleves);
