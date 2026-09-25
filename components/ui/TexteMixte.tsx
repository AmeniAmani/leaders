import { Fragment } from "react";
import { MORCEAU_ARABE } from "@/lib/bidi";

// Affiche un message en français qui contient des noms en arabe (classe, salle,
// matière) : chaque morceau arabe est isolé et garde son sens d'écriture, sans
// déplacer les chiffres et séparateurs voisins. Sert aussi aux messages déjà enregistrés.
export function TexteMixte({ texte }: { texte: string | null | undefined }) {
    if (!texte) return null;
    const morceaux: React.ReactNode[] = [];
    let fin = 0;
    for (const m of texte.matchAll(MORCEAU_ARABE)) {
        const debut = m.index ?? 0;
        if (debut > fin) morceaux.push(<Fragment key={fin}>{texte.slice(fin, debut)}</Fragment>);
        morceaux.push(<bdi key={debut} dir="rtl">{m[0]}</bdi>);
        fin = debut + m[0].length;
    }
    if (fin < texte.length) morceaux.push(<Fragment key={fin}>{texte.slice(fin)}</Fragment>);
    return <>{morceaux}</>;
}
