import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server';
import { filtreRecherche } from '../../../lib/recherche';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    try {
        // Peu de lignes (quelques centaines) : tout est lu puis filtré avec la recherche
        // commune (casse, accents, ordre des mots, téléphones chiffres seuls)
        const [tousEleves, tousEnseignants, tousParents] = await Promise.all([
            prisma.student.findMany({
                orderBy: { id: 'asc' },
                select: { id: true, firstName: true, lastName: true, idenelev: true, classId: true, photo: true },
            }),
            prisma.teacher.findMany({
                orderBy: { id: 'asc' },
                select: { id: true, name: true, email: true, phone: true, photo: true },
            }),
            prisma.parent.findMany({
                orderBy: { id: 'asc' },
                select: { id: true, name1: true, name2: true, phone1: true, phone2: true, username: true },
            }),
        ]);

        const correspond = filtreRecherche(query);
        const students = tousEleves.filter(s => correspond([s.firstName, s.lastName, s.idenelev])).slice(0, 5);
        const teachers = tousEnseignants.filter(t => correspond([t.name, t.email], [t.phone])).slice(0, 5);
        const parents = tousParents.filter(p => correspond([p.name1, p.name2, p.username], [p.phone1, p.phone2])).slice(0, 5);

        const results = [
            ...students.map(s => ({
                id: `student-${s.id}`,
                type: 'student',
                title: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Élève sans nom',
                subtitle: `ID: ${s.id || 'N/A'}`,
                href: `/students/${s.id}`,
                photo: `../${s.photo}`,
            })),
            ...teachers.map(t => ({
                id: `teacher-${t.id}`,
                type: 'teacher',
                title: t.name || 'Enseignant sans nom',
                subtitle: 'Enseignant',
                href: `/teachers/${t.id}`,
                photo: `../${t.photo}`,
            })),
            ...parents.map(p => ({
                id: `parent-${p.id}`,
                type: 'parent',
                title: `${p.name1 || ''} ${p.name2 || ''}`.trim() || 'Parent sans nom',
                subtitle: 'Parent',
                href: `/parents/${p.id}`,
            })),
        ];

        return NextResponse.json(results);
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
