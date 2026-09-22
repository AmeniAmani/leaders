"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker défini dans public/sw.js.
 *
 * Ce worker ne met rien en cache : il existe uniquement pour que Chrome
 * considère l'application comme installable sur l'écran d'accueil.
 * Il reste inactif tant que le site n'est pas servi en HTTPS, le navigateur
 * refusant d'enregistrer un service worker hors contexte sécurisé.
 */
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        // En HTTP simple, l'enregistrement échouerait : inutile de le tenter.
        if (!window.isSecureContext) return;

        const enregistrer = () => {
            navigator.serviceWorker
                .register("/sw.js", { scope: "/" })
                .catch((erreur) => {
                    console.error("Service worker non enregistré :", erreur);
                });
        };

        // On attend la fin du chargement pour ne pas concurrencer le rendu initial.
        if (document.readyState === "complete") {
            enregistrer();
            return;
        }
        window.addEventListener("load", enregistrer);
        return () => window.removeEventListener("load", enregistrer);
    }, []);

    return null;
}
