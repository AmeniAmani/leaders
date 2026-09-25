import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { alerterRepartition } from '../../../../lib/alertes-repartition';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> } 
) {
    try {
        const id = parseInt((await params).id);
        const planing = await prisma.planing.findUnique({
            where: { id },
            include: { teacher: true }
        });
        if (!planing) {
            return NextResponse.json({ error: 'Planing not found' }, { status: 404 });
        }
        return NextResponse.json(planing);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch planing' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> } 
) {
    try {
        const id = parseInt((await params).id);
        const data = await request.json();
        const { teacherId, as, type, datePlaning, description, name, classId } = data;

        const cookiesStore = await cookies();
        const nameuser = cookiesStore.get('user-name')?.value;
        const session = {
            role: String(cookiesStore.get('user-role')?.value || ""),
            userId: Number(cookiesStore.get('user-id')?.value) || 0,
        };

        const planing = await prisma.$transaction(async (tx) => {
            const p = await tx.planing.update({
                where: { id },
                data: {
                    teacherId: teacherId ? parseInt(teacherId) : undefined,
                    as,
                    type,
                    datePlaning: datePlaning ? new Date(datePlaning) : undefined,
                    description,
                    name,
                    classId: classId ? parseInt(classId) : null,
                },
                include: { teacher: true }
            });

            // Log Activity
            await tx.activity.create({
                data: {
                    nameUser: nameuser || 'System',
                    description: `a modifié une répartition pour: ${p.teacher?.name || 'Inconnu'}.`,
                }
            });

            await alerterRepartition(tx, session, "modification", p);
            return p;
        });

        return NextResponse.json(planing);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update planing' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> } 
) {
    try {
        const id = parseInt((await params).id);
        const cookiesStore = await cookies();
        const nameuser = cookiesStore.get('user-name')?.value;
        const session = {
            role: String(cookiesStore.get('user-role')?.value || ""),
            userId: Number(cookiesStore.get('user-id')?.value) || 0,
        };

        await prisma.$transaction(async (tx) => {
            const p = await tx.planing.delete({
                where: { id },
                include: { teacher: true }
            });

            // Log Activity
            await tx.activity.create({
                data: {
                    nameUser: nameuser || 'System',
                    description: `a supprimé une répartition pour: ${p.teacher?.name || 'Inconnu'}.`,
                }
            });

            // Classe et enseignant relus sur la ligne supprimée, renvoyée par delete
            await alerterRepartition(tx, session, "suppression", p);
        });

        return NextResponse.json({ message: 'Planing deleted' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete planing' }, { status: 500 });
    }
}
