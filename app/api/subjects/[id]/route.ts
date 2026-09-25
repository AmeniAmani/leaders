import { cookies } from 'next/headers';
import  prisma  from '../../../../lib/prisma';
import { isoler } from '../../../../lib/bidi';
import { NextResponse } from 'next/server'

// Un volume horaire valide, ou null si le niveau n'est pas concerné
const heures = (valeur: any): number | null => {
    if (valeur === null || valeur === undefined || valeur === "") return null;
    const n = Number(valeur);
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n);
};

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const subject = await prisma.subject.findUnique({
        where: {
            id: parseInt(id),
        },
        include: {
            teachers: true
        }
    })

    if (!subject) {
        return new NextResponse(null, { status: 404 })
    }

    return NextResponse.json(subject)
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const json = await request.json()

        if (!json.name || !String(json.name).trim()) {
            return NextResponse.json(
                { error: 'Le nom de la matière est obligatoire' },
                { status: 400 }
            )
        }

        const h1 = heures(json.hoursLevel1);
        const h2 = heures(json.hoursLevel2);
        const h3 = heures(json.hoursLevel3);

        // Une matière doit être enseignée dans au moins un niveau
        if (h1 === null && h2 === null && h3 === null) {
            return NextResponse.json(
                { error: "Indiquez le nombre d'heures par semaine pour au moins un niveau" },
                { status: 400 }
            )
        }

        const subject = await prisma.subject.update({
            where: {
                id: parseInt(id),
            },
            data: {
                name: String(json.name).trim(),
                codematiere: json.codematiere || null,
                hoursLevel1: h1,
                hoursLevel2: h2,
                hoursLevel3: h3,
            },
        })

        // Journal d'activité
        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value || "Inconnu");
        const detail = [
            h1 ? `7ème ${h1}h` : null,
            h2 ? `8ème ${h2}h` : null,
            h3 ? `9ème ${h3}h` : null,
        ].filter(Boolean).join(', ');

        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a modifié la matière ${isoler(subject.name)} (${detail}).`,
            }
        });

        return NextResponse.json(subject)
    } catch (error) {
        console.error("Erreur mise à jour matière:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la mise à jour" }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const subjectId = parseInt(id);

        // Une matière encore rattachée à des enseignants ou à des cours
        // ne peut pas être supprimée sans casser ces liens.
        const [nbTeachers, nbSchedules] = await Promise.all([
            prisma.teacher.count({ where: { subjectId } }),
            prisma.schedule.count({ where: { subjectId } }),
        ]);

        if (nbTeachers > 0) {
            return NextResponse.json(
                { error: `Cette matière est assignée à ${nbTeachers} enseignant(s). Retirez-la de leurs fiches avant de la supprimer.` },
                { status: 409 }
            )
        }

        if (nbSchedules > 0) {
            return NextResponse.json(
                { error: `Cette matière figure dans ${nbSchedules} créneau(x) de l'emploi du temps. Retirez-les avant de la supprimer.` },
                { status: 409 }
            )
        }

        const subject = await prisma.subject.delete({
            where: { id: subjectId },
        })

        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value || "Inconnu");
        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a supprimé la matière ${isoler(subject.name)}.`,
            }
        });

        return NextResponse.json(subject)
    } catch (error) {
        console.error("Erreur suppression matière:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la suppression" }, { status: 500 })
    }
}