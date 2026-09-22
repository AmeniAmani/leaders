import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server';

// Alertes non lues, pour l'administration
export async function GET() {
    const store = await cookies();
    const role = String(store.get('user-role')?.value || "");

    if (role !== 'admin') {
        return NextResponse.json([]);
    }

    const alerts = await prisma.adminAlert.findMany({
        where: { read: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    return NextResponse.json(alerts);
}

// Acquitter une alerte
export async function POST(request: Request) {
    try {
        const { alertId } = await request.json();

        const store = await cookies();
        const role = String(store.get('user-role')?.value || "");

        if (role !== 'admin') {
            return NextResponse.json({ error: "Action réservée à l'administration" }, { status: 403 });
        }

        if (!alertId) {
            return NextResponse.json({ error: "alertId requis" }, { status: 400 });
        }

        const updated = await prisma.adminAlert.update({
            where: { id: Number(alertId) },
            data: { read: true, readAt: new Date() }
        });

        return NextResponse.json({ success: true, alert: updated });
    } catch (error) {
        console.error("Erreur acquittement alerte:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}