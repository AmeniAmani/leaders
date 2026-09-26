import { NextResponse } from 'next/server';
import prisma from '../../../../../../lib/prisma';
import { isParentActive } from '../../../../../../lib/mobile-auth';

// Le parent supprime une notification de sa liste. Elle est seulement masquée pour lui :
// la ligne reste en base comme preuve d'envoi (hiddenAt = date de la suppression).
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const parentId = new URL(request.url).searchParams.get('parentId') || request.headers.get('x-parent-id');

        if (!parentId || !Number(id)) {
            return NextResponse.json({ error: "parentId and id are required" }, { status: 400 });
        }

        if (!(await isParentActive(parentId))) {
            return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
        }

        // Seulement une notification de ce parent ; déjà masquée : rien à faire
        const notification = await prisma.notification.findFirst({
            where: { id: Number(id), parentId: Number(parentId) },
            select: { id: true, hiddenAt: true },
        });
        if (!notification) {
            return NextResponse.json({ error: "Notification introuvable" }, { status: 404 });
        }
        if (!notification.hiddenAt) {
            await prisma.notification.update({ where: { id: notification.id }, data: { hiddenAt: new Date() } });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Hide notification error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
