import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const parent = await prisma.parent.findUnique({
        where: {
            id: Number(params.id)
        },
        include: {
            childrenIds: true
        }
    })
    return NextResponse.json(parent)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const json = await request.json()

        // Le tuteur 1 est le contact principal : il doit rester renseigné
        if (!json.name1 || !String(json.name1).trim()) {
            return NextResponse.json({ error: "Le nom du tuteur 1 est obligatoire" }, { status: 400 })
        }
        if (!json.phone1 || !String(json.phone1).trim()) {
            return NextResponse.json({ error: "Le téléphone du tuteur 1 est obligatoire" }, { status: 400 })
        }

        const updateData: any = {
            name1: String(json.name1).trim(),
            relation1: json.relation1,
            email1: json.email1,
            phone1: String(json.phone1).trim(),
            name2: json.name2,
            relation2: json.relation2,
            email2: json.email2,
            phone2: json.phone2,
            username: json.username,
            active: json.active
        }
        if (json.password) {
            updateData.password = await bcrypt.hash(json.password, 10)
        }

        const parent = await prisma.parent.update({
            where: {
                id: Number(params.id)
            },
            data: updateData
        })

        // Journal d'activité
        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value || "Inconnu");
        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a modifié le parent ${parent.name1}`,
            }
        });

        return NextResponse.json(parent)
    } catch (error) {
        console.error("Erreur mise à jour parent:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la mise à jour" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const parentId = Number(params.id);

        // Un parent encore rattaché à des élèves ne peut pas être supprimé :
        // ces élèves se retrouveraient sans tuteur, et leur famille perdrait
        // l'accès à l'application mobile.
        const enfants = await prisma.student.findMany({
            where: { parentId },
            select: { firstName: true, lastName: true }
        });

        if (enfants.length > 0) {
            const noms = enfants
                .map(e => `${e.firstName || ''} ${e.lastName || ''}`.trim())
                .filter(Boolean)
                .join(', ');
            return NextResponse.json(
                {
                    error: `Ce parent est rattaché à ${enfants.length} élève(s) : ${noms}. ` +
                           `Rattachez-les à un autre parent avant de le supprimer.`
                },
                { status: 409 }
            )
        }

        const nameuser = String((await cookies()).get('user-name')?.value || "Inconnu");

        const parent = await prisma.$transaction(async (tx) => {
            // Les notifications référencent le parent : elles partent avec lui
            await tx.notification.deleteMany({ where: { parentId } });

            const supprime = await tx.parent.delete({
                where: { id: parentId }
            });

            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a supprimé le parent ${supprime.name1}`,
                }
            });

            return supprime;
        });

        return NextResponse.json(parent)
    } catch (error) {
        console.error("Erreur suppression parent:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la suppression" }, { status: 500 })
    }
}