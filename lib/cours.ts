// Contrôle d'un cours de l'emploi du temps reçu par l'API (ajout et modification).
// Renvoie le message à afficher, ou null si tout est correct.
export function erreurCours(json: any): string | null {
    if (!Number(json?.subjectId)) return "La matière est obligatoire";
    if (!Number(json?.roomId)) return "La salle est obligatoire";
    if (!Number(json?.teacherId)) return "L'enseignant est obligatoire";
    if (!Number(json?.classId)) return "La classe est obligatoire";

    const duree = Number(json?.duration);
    if (!Number.isInteger(duree) || duree < 1 || duree > 4) {
        return "La durée doit être un nombre entier d'heures, de 1 à 4";
    }
    return null;
}
