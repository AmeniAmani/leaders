import prisma from './prisma';

// Téléphones des parents inscrits aux notifications push (identifiants Firebase).

// Identifiant Firebase plausible : on refuse le vide et l'absurde, sans dépendre de son format exact
export const jetonValide = (jeton: unknown): jeton is string =>
    typeof jeton === 'string' && jeton.length >= 20 && jeton.length <= 4096;

const plateforme = (p: unknown) => typeof p === 'string' ? p.slice(0, 20) : null;

// À la connexion : le téléphone est rattaché à ce parent (même s'il l'était à un autre avant).
// Renvoie true si le téléphone est inscrit ; une erreur ne fait jamais échouer la connexion.
export async function enregistrerAppareil(parentId: number, jeton: unknown, p: unknown): Promise<boolean> {
    if (!jetonValide(jeton)) return false;
    try {
        await prisma.parentDevice.upsert({
            where: { token: jeton },
            create: { parentId, token: jeton, platform: plateforme(p) },
            update: { parentId, platform: plateforme(p), lastSeenAt: new Date() },
        });
        return true;
    } catch (error) {
        console.error("Push : inscription du téléphone impossible", error);
        return false;
    }
}
