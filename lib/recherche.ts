// Recherche commune aux listes et à la recherche globale : sans tenir compte de la
// casse, des accents ni des espaces en trop, mots dans n'importe quel ordre,
// téléphones comparés chiffres seuls. Aucune dépendance serveur : sert aux pages
// comme aux routes API. Les noms en base ne sont jamais modifiés.

export const normaliser = (s: unknown) =>
    String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const chiffres = (s: unknown) => String(s ?? "").replace(/\D/g, "");

// Téléphone chiffres seuls, sans l'indicatif de la Tunisie (+216 ou 00216)
export const telephone = (s: unknown) => {
    const n = chiffres(s);
    if (n.length > 8 && n.startsWith("00216")) return n.slice(5);
    if (n.length > 8 && n.startsWith("216")) return n.slice(3);
    return n;
};

// « +216 » ou « 00216 » tapé seul : ignoré
const INDICATIF = /^(\+|00)216$/;
// Un mot fait uniquement de chiffres et de séparateurs est aussi cherché dans les téléphones
const NUMERO = /^[\d.+()-]+$/;

// Filtre pour une saisie donnée : chaque mot tapé doit se retrouver quelque part,
// dans les textes ou, chiffres seuls, dans les téléphones
// (« 22 546 » trouve « 22546960 », « +216 22546960 » aussi).
export function filtreRecherche(requete: string) {
    const mots = normaliser(requete).split(" ").filter(m => m && !INDICATIF.test(m));
    return (textes: unknown[], telephones: unknown[] = []) => {
        if (mots.length === 0) return true;
        const texte = textes.map(normaliser).join(" ");
        const numeros = telephones.map(telephone).filter(Boolean);
        return mots.every(mot => {
            if (texte.includes(mot)) return true;
            if (!NUMERO.test(mot)) return false;
            const num = telephone(mot);
            return num.length > 0 && numeros.some(t => t.includes(num));
        });
    };
}
