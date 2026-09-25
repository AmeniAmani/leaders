// Messages d'erreur des formulaires : on affiche ce que le serveur a répondu
// plutôt qu'un message générique.

// Message renvoyé par une API en échec ({ error } ou { message }),
// ou le code HTTP quand la réponse n'est pas lisible (page d'erreur, 500 brut).
export async function messageErreur(res: Response): Promise<string> {
    try {
        const data = await res.clone().json();
        const message = data?.message && data?.error === "CONFLICT" ? data.message : (data?.error || data?.message);
        if (typeof message === "string" && message.trim()) return message;
    } catch {
        // réponse non JSON
    }
    return `Erreur du serveur (code ${res.status})`;
}

// Message à afficher dans un catch : fetch qui échoue = serveur injoignable.
export function messageException(err: unknown): string {
    if (err instanceof TypeError) return "Impossible de joindre le serveur. Vérifiez la connexion.";
    if (err instanceof Error && err.message) return err.message;
    return "Erreur inconnue";
}

// Date saisie dans un <input type="date"> (AAAA-MM-JJ) réellement valide
export function dateValide(valeur: unknown): boolean {
    if (typeof valeur !== "string" || !valeur.trim()) return false;
    return !isNaN(new Date(valeur).getTime());
}
