// Cookies de session, écrits et effacés par le navigateur (côté client uniquement).
//
// Enseignant : la tablette est partagée, la session prend fin après 1 heure sans
// activité. « session-activite » garde l'heure de la dernière activité (ms) ;
// auth-token, user-name et user-id sont prolongés d'une heure à chaque activité,
// pour expirer d'eux-mêmes si la tablette reste éteinte.

export const COOKIES_SESSION = ["auth-token", "user-name", "user-role", "user-id", "session-activite"];

export const INACTIVITE_MAX_PROF = 60 * 60; // secondes

// Après une déconnexion, retient seulement quelle page de connexion proposer
// ("prof" ou "admin"). Ni identité ni accès : proxy.ts s'en sert pour renvoyer vers
// /prof plutôt que /login, par exemple après le bouton Retour.
export const COOKIE_ESPACE = "espace-connexion";

export const lireCookie = (name: string) => {
    if (typeof document === "undefined") return null;
    return document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="))
        ?.split("=")[1] ?? null;
};

const ecrire = (name: string, value: string, maxAge: number) => {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

// Ouverture de la session enseignant
export function ouvrirSessionProf(user: { displayName: string; id: number; role: string }) {
    ecrire("auth-token", "authenticated", INACTIVITE_MAX_PROF);
    ecrire("user-name", encodeURIComponent(user.displayName), INACTIVITE_MAX_PROF);
    ecrire("user-id", String(user.id), INACTIVITE_MAX_PROF);
    // Le rôle dure plus longtemps : à l'expiration, il permet de revenir sur /prof
    ecrire("user-role", user.role, 60 * 60 * 24);
    ecrire("session-activite", String(Date.now()), INACTIVITE_MAX_PROF);
}

// Activité de l'enseignant : la session repart pour une heure
export function prolongerSessionProf() {
    for (const name of ["auth-token", "user-name", "user-id"]) {
        const value = lireCookie(name);
        if (value !== null) ecrire(name, value, INACTIVITE_MAX_PROF);
    }
    ecrire("session-activite", String(Date.now()), INACTIVITE_MAX_PROF);
}

// Session enseignant terminée : cookie absent, ou plus d'une heure sans activité
export function sessionProfExpiree() {
    if (!lireCookie("auth-token")) return true;
    const derniere = Number(lireCookie("session-activite"));
    // Session ouverte avant la mise en place du suivi : auth-token expire de lui-même
    if (!derniere) return false;
    return Date.now() - derniere > INACTIVITE_MAX_PROF * 1000;
}

// Déconnexion : tous les cookies de session sont effacés
export function effacerSession() {
    for (const name of COOKIES_SESSION) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
}

// Déconnexion complète : cookies effacés, puis rechargement de la page de connexion.
// replace() retire la page courante de l'historique (le bouton Retour ne la rouvre pas)
// et le rechargement vide les données gardées en mémoire par l'application.
export function deconnecter(destination: string) {
    effacerSession();
    document.cookie = `${COOKIE_ESPACE}=${destination === "/prof" ? "prof" : "admin"}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    window.location.replace(destination);
}
