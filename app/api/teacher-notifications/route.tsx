import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Notifications non lues de l'enseignant connecté (billets envoyés par l'administration).
// Même forme que /api/admin-alerts, pour la cloche du Topbar.
export async function GET() {
    const store = await cookies();
    const role = String(store.get('user-role')?.value || "");
    const teacherId = Number(store.get('user-id')?.value);

    if (role !== 'prof' || !teacherId) {
        return NextResponse.json([]);
    }

    const notifications = await prisma.teacherNotification.findMany({
        where: { teacherId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, type: true, message: true, createdAt: true, read: true },
    });

    return NextResponse.json(notifications);
}

// Marquer une notification comme lue
export async function POST(request: Request) {
    try {
        const { alertId } = await request.json();

        const store = await cookies();
        const teacherId = Number(store.get('user-id')?.value);

        if (!alertId || !teacherId) {
            return NextResponse.json({ error: "alertId requis" }, { status: 400 });
        }

        // Un enseignant n'acquitte que ses propres notifications
        const { count } = await prisma.teacherNotification.updateMany({
            where: { id: Number(alertId), teacherId },
            data: { read: true, readAt: new Date() },
        });
        if (count === 0) {
            return NextResponse.json({ error: "Notification introuvable" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur acquittement notification:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}
