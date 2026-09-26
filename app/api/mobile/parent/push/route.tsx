import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { jetonValide } from '../../../../../lib/appareils';

// Téléphone déjà inscrit à la connexion (voir /api/mobile/auth/login).
// Il faut présenter l'identifiant actuel, que seul ce téléphone connaît : impossible d'abonner
// son téléphone aux notifications d'un autre parent avec son seul numéro.

// Firebase a renouvelé l'identifiant du téléphone : { ancien, nouveau }
export async function PUT(request: Request) {
    try {
        const { ancien, nouveau } = await request.json();
        if (!jetonValide(ancien) || !jetonValide(nouveau)) {
            return NextResponse.json({ error: "Identifiants requis" }, { status: 400 });
        }

        const appareil = await prisma.parentDevice.findUnique({ where: { token: ancien } });
        if (!appareil) {
            // Inconnu (supprimé par Firebase ou déconnecté) : il faudra se reconnecter
            return NextResponse.json({ error: "Téléphone non inscrit" }, { status: 404 });
        }

        if (ancien !== nouveau) {
            await prisma.$transaction([
                prisma.parentDevice.deleteMany({ where: { token: nouveau } }),
                prisma.parentDevice.update({
                    where: { id: appareil.id },
                    data: { token: nouveau, lastSeenAt: new Date() },
                }),
            ]);
        } else {
            await prisma.parentDevice.update({ where: { id: appareil.id }, data: { lastSeenAt: new Date() } });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Push : renouvellement impossible", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Déconnexion : le téléphone ne reçoit plus rien. { token }
export async function DELETE(request: Request) {
    try {
        const { token } = await request.json();
        if (!jetonValide(token)) {
            return NextResponse.json({ error: "Identifiant requis" }, { status: 400 });
        }
        await prisma.parentDevice.deleteMany({ where: { token } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Push : désinscription impossible", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
