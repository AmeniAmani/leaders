import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { isParentActive } from '../../../../../lib/mobile-auth';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const parentId = searchParams.get('parentId');

        if (!parentId) {
            return NextResponse.json({ error: "parentId is required" }, { status: 400 });
        }

        const isActive = await isParentActive(parentId);
        if (!isActive) {
            return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
        }

        const notifications = await prisma.notification.findMany({
            where: { parentId: Number(parentId), hiddenAt: null },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        return NextResponse.json(notifications);
    } catch (error: any) {
        console.error("Fetch notifications error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
