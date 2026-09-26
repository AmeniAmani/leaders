import { readFileSync } from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message, type Messaging } from 'firebase-admin/messaging';
import prisma from './prisma';

// Notifications push vers les téléphones des parents (Firebase, projet leaders-parents).
// La notification est toujours enregistrée en base avant : le push n'est qu'un signal en plus.
// Un échec d'envoi est écrit dans les journaux, sans jamais faire échouer la requête d'origine.

const FICHIER_CLE = process.env.FIREBASE_ADMIN_FILE || '/etc/leaders-parent/firebase-admin.json';

// Android : canal créé par l'application (voir src/lib/push.ts côté application)
const CANAL_ANDROID = 'leaders';

// Firebase refuse plus de 500 messages par appel
const TAILLE_LOT = 500;

// Identifiants à oublier : application désinstallée ou identifiant renouvelé
const JETON_PERIME = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
]);

export type EnvoiPush = {
    parentId: number;
    title: string;
    body: string;
    type: string;
    // Élève concerné : l'application ouvre sa page en touchant la notification
    studentId?: number | null;
};

let messaging: Messaging | null | undefined;

function client(): Messaging | null {
    if (messaging !== undefined) return messaging;
    try {
        const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(readFileSync(FICHIER_CLE, 'utf8'))) });
        messaging = getMessaging(app);
    } catch (error) {
        console.error(`Push : clé Firebase illisible (${FICHIER_CLE}), notifications push désactivées`, error);
        messaging = null;
    }
    return messaging;
}

// Lance l'envoi sans attendre : la réponse à l'administration n'est pas retardée.
export function envoyerPush(envois: EnvoiPush[]): void {
    if (envois.length === 0) return;
    envoyer(envois).catch((error) => console.error("Push : échec de l'envoi", error));
}

async function envoyer(envois: EnvoiPush[]) {
    const fcm = client();
    if (!fcm) return;

    // Téléphones des parents concernés, comptes désactivés exclus
    const appareils = await prisma.parentDevice.findMany({
        where: {
            parentId: { in: Array.from(new Set(envois.map(e => e.parentId))) },
            parent: { OR: [{ active: true }, { active: null }] },
        },
        select: { parentId: true, token: true },
    });
    if (appareils.length === 0) return;

    const jetonsParParent = new Map<number, string[]>();
    for (const a of appareils) {
        jetonsParParent.set(a.parentId, [...(jetonsParParent.get(a.parentId) || []), a.token]);
    }

    const messages: Message[] = envois.flatMap((e) => (jetonsParParent.get(e.parentId) || []).map((token) => message(token, e)));

    let envoyes = 0;
    const perimes: string[] = [];
    for (let i = 0; i < messages.length; i += TAILLE_LOT) {
        const lot = messages.slice(i, i + TAILLE_LOT);
        const resultat = await fcm.sendEach(lot);
        envoyes += resultat.successCount;
        resultat.responses.forEach((r, j) => {
            if (r.success) return;
            const code = r.error?.code || '';
            if (JETON_PERIME.has(code)) perimes.push((lot[j] as { token: string }).token);
            else console.error(`Push : refusé par Firebase (${code})`, r.error?.message);
        });
    }

    if (perimes.length > 0) {
        await prisma.parentDevice.deleteMany({ where: { token: { in: perimes } } });
    }
    console.log(`Push : ${envoyes}/${messages.length} envoyé(s)` + (perimes.length ? `, ${perimes.length} téléphone(s) oublié(s)` : ''));
}

function message(token: string, e: EnvoiPush): Message {
    return {
        token,
        notification: {
            title: e.title,
            // Firebase limite la taille du message : un long TAF est coupé, le texte complet reste dans l'application
            body: e.body.length > 1000 ? `${e.body.slice(0, 997)}…` : e.body,
        },
        data: {
            type: e.type,
            ...(e.studentId ? { studentId: String(e.studentId) } : {}),
        },
        android: {
            priority: 'high',
            notification: { channelId: CANAL_ANDROID, sound: 'default' },
        },
    };
}
