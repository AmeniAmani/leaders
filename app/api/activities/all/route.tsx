import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // ?years=1 : liste des annees presentes dans l historique
    if (searchParams.get('years')) {
        const oldest = await prisma.activity.findFirst({
            where: { dateActivity: { not: null } },
            orderBy: { dateActivity: 'asc' },
            select: { dateActivity: true }
        });
        const end = new Date().getFullYear();
        const start = oldest?.dateActivity ? oldest.dateActivity.getFullYear() : end;
        const years: string[] = [];
        for (let y = end; y >= start; y--) years.push(String(y));
        return NextResponse.json(years);
    }

    // ?from=...&to=... : periode demandee (jour ou annee)
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const where: any = {};

    if (fromStr || toStr) {
        const from = fromStr ? new Date(fromStr) : null;
        const to = toStr ? new Date(toStr) : null;
        if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
            return NextResponse.json({ error: "Date invalide" }, { status: 400 });
        }
        where.dateActivity = {};
        if (from) where.dateActivity.gte = from;
        if (to) where.dateActivity.lt = to;
    }

    try {
        const activities = await prisma.activity.findMany({
            where,
            orderBy: { dateActivity: 'desc' },
            take: 2000
        });
        return NextResponse.json(activities);
    } catch (error) {
        console.error("Error fetching activities:", error);
        return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
    }
}