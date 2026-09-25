// Texte arabe au milieu de français, de chiffres ou de séparateurs.
// Sans isolement, le navigateur rattache chiffres et séparateurs voisins à l'arabe
// et retourne le tout : « القاعة 2 | السابعة أساسي 1 » s'affiche mélangé.

// Isole un morceau de texte brut (message enregistré, option de liste, info-bulle,
// fenêtre de confirmation) : U+2068 FSI … U+2069 PDI, équivalent texte de dir="auto".
export const isoler = (texte: string | null | undefined) =>
    texte ? `⁨${texte}⁩` : "";

// Morceaux arabes d'un texte, avec le numéro qui les suit (« السابعة أساسي 1 », « القاعة 02 »)
export const MORCEAU_ARABE = /[؀-ۿ](?:[؀-ۿ\s]*[؀-ۿ])?(?:\s+\d+)?/g;
