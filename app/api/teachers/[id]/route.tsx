import prisma from '../../../../lib/prisma';
import { isoler } from '../../../../lib/bidi';
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';

// Libellé arabe d'une classe (même logique que le reste de l'application)
const classLabel = (level: string | null, name: string | null) => {
    const prefix =
        level === "1" ? "السابعة أساسي " :
        level === "2" ? "الثامنة أساسي " :
        level === "3" ? "التاسعة أساسي " : "";
    return prefix + (name || "");
};

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const teacher = await prisma.teacher.findUnique({
        where: {
            id: Number(params.id)
        },
        include: {
            subject: true,
            user: true,
            classes: true
        }
    })
    return NextResponse.json(teacher)
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const teacherId = parseInt(id);
        const formData = await request.formData();

        // Extract fields
        const name = formData.get('name') as string;
        const iuense = formData.get('iuense') as string;
        const email = formData.get('email') as string;
        const phone = formData.get('phone') as string;
        const gender = formData.get('gender') as string;
        const diploma = formData.get('diploma') as string;
        const subjectId = formData.get('subjectId') ? parseInt(formData.get('subjectId') as string) : null;
        const file = formData.get('photo') as File | null;

        // Classes sélectionnées + confirmation de remplacement
        const classIdsRaw = formData.get('classIds') as string | null;
        let classIds: number[] = [];
        let classIdsProvided = false;
        if (classIdsRaw) {
            try {
                const parsed = JSON.parse(classIdsRaw);
                if (Array.isArray(parsed)) {
                    classIds = parsed.map((v: any) => Number(v)).filter((v: number) => !isNaN(v));
                    classIdsProvided = true;
                }
            } catch {
                classIds = [];
            }
        }
        const confirmReplace = formData.get('confirmReplace') === '1';

        if (!subjectId) {
            return NextResponse.json({ error: "La matière principale est obligatoire" }, { status: 400 });
        }
        if (!classIdsProvided || classIds.length === 0) {
            return NextResponse.json({ error: "Au moins une classe enseignée est obligatoire" }, { status: 400 });
        }

        // --- Règle : une classe ne peut avoir qu'un seul enseignant par matière ---
        // L'enseignant en cours de modification est exclu : il ne peut pas être
        // en conflit avec lui-même sur une classe qu'il assure déjà.
        type Conflict = {
            classId: number
            className: string
            teacherId: number
            teacherName: string
            subjectName: string
        }
        let conflicts: Conflict[] = [];

        if (subjectId && classIds.length > 0) {
            const conflictClasses = await prisma.class.findMany({
                where: {
                    id: { in: classIds },
                    teachers: { some: { subjectId, id: { not: teacherId } } }
                },
                include: {
                    teachers: {
                        where: { subjectId, id: { not: teacherId } },
                        include: { subject: true }
                    }
                }
            });

            for (const c of conflictClasses) {
                for (const t of c.teachers) {
                    conflicts.push({
                        classId: c.id,
                        className: isoler(classLabel(c.level, c.name)),
                        teacherId: t.id,
                        teacherName: t.name || "Enseignant",
                        subjectName: isoler(t.subject?.name) || "cette matière",
                    });
                }
            }
        }

        // Conflit non confirmé : on bloque et on renvoie le détail au client
        if (conflicts.length > 0 && !confirmReplace) {
            return NextResponse.json(
                { error: "CONFLICT", message: "Ces classes ont déjà un enseignant dans la même matière.", conflicts },
                { status: 409 }
            );
        }

        // Photo
        let photoPath: string | undefined = undefined;
        if (file && file.size > 0) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const ext = path.extname(file.name);
            const filename = `${id}${ext}`;

            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'teachers');
            await mkdir(uploadDir, { recursive: true });
            await writeFile(path.join(uploadDir, filename), buffer);

            photoPath = `/uploads/teachers/${filename}`;
        }

        // Nom de l'utilisateur connecté, pour le journal d'activité
        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value || "Inconnu");

        // --- Mise à jour dans une transaction ---
        const teacher = await prisma.$transaction(async (tx) => {
            // 1. Retirer la classe aux anciens enseignants de la même matière
            for (const c of conflicts) {
                await tx.teacher.update({
                    where: { id: c.teacherId },
                    data: { classes: { disconnect: { id: c.classId } } }
                });
            }

            // 2. Mettre à jour l'enseignant.
            //    "set" remplace la liste complète : les classes décochées sont retirées.
            const updated = await tx.teacher.update({
                where: { id: teacherId },
                data: {
                    name,
                    iuense,
                    email,
                    phone,
                    gender,
                    diploma,
                    subjectId,
                    ...(photoPath && { photo: photoPath }),
                    ...(classIdsProvided && {
                        classes: { set: classIds.map((cid) => ({ id: cid })) }
                    }),
                },
                include: {
                    user: true,
                    classes: true,
                },
            });

            // 3. Journal d'activité
            let description = `a modifié le professeur: ${updated.name}.`;
            if (classIdsProvided) {
                description += ` Classes: ${classIds.length}.`;
            }
            if (conflicts.length > 0) {
                description += ` Remplacement: ${conflicts.map(c => `${c.className} (${c.teacherName})`).join(', ')}.`;
            }
            await tx.activity.create({
                data: { nameUser: nameuser, description }
            });

            return updated;
        });

        return NextResponse.json(teacher)
    } catch (error) {
        console.error("Error updating teacher:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la mise à jour" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const teacherId = Number(params.id);

        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value || "Inconnu");

        const teacher = await prisma.$transaction(async (tx) => {
            // Détacher les classes et supprimer le compte lié avant l'enseignant,
            // sinon la contrainte de clé étrangère sur User.idTeach bloque la suppression.
            await tx.teacher.update({
                where: { id: teacherId },
                data: { classes: { set: [] } }
            });

            await tx.user.deleteMany({ where: { idTeach: teacherId } });

            const deleted = await tx.teacher.delete({
                where: { id: teacherId }
            });

            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a supprimé le professeur: ${deleted.name}.`,
                }
            });

            return deleted;
        });

        return NextResponse.json(teacher)
    } catch (error) {
        console.error("Error deleting teacher:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la suppression" }, { status: 500 })
    }
}