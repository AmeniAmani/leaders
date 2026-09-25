// Types des alertes de l'administration (AdminAlert.type), côté pages et côté API.

// Absences des élèves : signalements, retraits, modifications, élèves sans billet,
// billets d'entrée non honorés. Seules ces alertes figurent dans le bandeau de /absences ;
// les réservations et les répartitions restent dans la cloche du Topbar.
export const estAlerteAbsence = (type?: string | null) =>
    /^(absence|signalement|sans-billet|billet)/.test(type ?? "");

// Réservation de la salle de cinéma (demande ou annulation)
export const estAlerteReservation = (type?: string | null) =>
    (type ?? "").startsWith("reservation");

// Répartition enregistrée, modifiée ou supprimée par un enseignant
export const estAlerteRepartition = (type?: string | null) =>
    (type ?? "").startsWith("planing");
