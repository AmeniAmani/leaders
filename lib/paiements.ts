// Contrôle d'un paiement reçu par l'API (création et modification).
// Renvoie le message à afficher, ou null si tout est correct.
const MODES = ["comptant", "cheque", "virement"];

export function erreurPaiement(json: any): string | null {
    if (!Number(json?.studentId)) return "L'élève est obligatoire";
    if (!json?.as || !String(json.as).trim()) return "L'année scolaire est obligatoire";

    const lignes = Array.isArray(json?.paymentLines) ? json.paymentLines : [];
    if (lignes.length === 0) return "Saisissez au moins une ligne de paiement";

    for (const ligne of lignes) {
        if (!ligne?.title || !String(ligne.title).trim()) return "Le titre est obligatoire sur chaque ligne";
        const montant = Number(ligne.amount);
        if (!isFinite(montant) || montant <= 0) return "Le montant doit être supérieur à 0 sur chaque ligne";
        if (!MODES.includes(ligne.type)) return "Le mode de règlement est obligatoire sur chaque ligne";
        if (ligne.type === "cheque" && (!ligne.numCheque || !String(ligne.numCheque).trim())) {
            return "Le numéro de chèque est obligatoire pour un paiement par chèque";
        }
    }
    return null;
}
