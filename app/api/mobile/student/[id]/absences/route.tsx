import { NextResponse } from 'next/server';
import prisma from '../../../../../../lib/prisma';
import { isParentActive } from '../../../../../../lib/mobile-auth';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const { searchParams } = new URL(request.url);
        const parentId = searchParams.get('parentId');

        if (parentId) {
            const isActive = await isParentActive(parentId);
            if (!isActive) {
                return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
            }
        }

        const absences = await prisma.absence.findMany({
            where: {
                studentId: Number(params.id),
                // Seules les absences envoyées par l'administration sont visibles
                validated: true,
            },
            include: {
                classe: true
            },
            orderBy: { dateAbsence: 'desc' }
        });

        return NextResponse.json(absences);
    } catch (error) {
        console.error("Fetch absences error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}