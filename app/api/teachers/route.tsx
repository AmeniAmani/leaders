import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs';
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

export async function GET() {
    const teachers = await prisma.teacher.findMany({
        include: {
            subject: true,
            user: true,
            classes: true
        }
    })
    return NextResponse.json(teachers)
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData()

        // Extract fields
        const name = formData.get('name') as string
        const iuense = formData.get('iuense') as string
        const email = formData.get('email') as string
        const phone = formData.get('phone') as string
        const gender = formData.get('gender') as string
        const diploma = formData.get('diploma') as string
        const subjectId = formData.get('subjectId') ? parseInt(formData.get('subjectId') as string) : null
        const login = formData.get('login') as string
        const password = formData.get('password') as string
        const file = formData.get('photo') as File | null

        // Classes sélectionnées + confirmation de remplacement
        const classIdsRaw = formData.get('classIds') as string | null
        let classIds: number[] = []
        if (classIdsRaw) {
            try {
                const parsed = JSON.parse(classIdsRaw)
                if (Array.isArray(parsed)) {
                    classIds = parsed.map((v: any) => Number(v)).filter((v: number) => !isNaN(v))
                }
            } catch {
                classIds = []
            }
        }
        const confirmReplace = formData.get('confirmReplace') === '1'

        if (!login || !password) {
            return NextResponse.json({ error: "Identifiant et mot de passe requis" }, { status: 400 })
        }

        // À la création, la matière et au moins une classe sont obligatoires
        if (!subjectId) {
            return NextResponse.json({ error: "La matière principale est obligatoire" }, { status: 400 })
        }

        if (classIds.length === 0) {
            return NextResponse.json({ error: "Au moins une classe enseignée est obligatoire" }, { status: 400 })
        }

        // --- Règle : une classe ne peut avoir qu'un seul enseignant par matière ---
        type Conflict = {
            classId: number
            className: string
            teacherId: number
            teacherName: string
            subjectName: string
        }
        let conflicts: Conflict[] = []

        if (subjectId && classIds.length > 0) {
            const conflictClasses = await prisma.class.findMany({
                where: {
                    id: { in: classIds },
                    teachers: { some: { subjectId } }
                },
                include: {
                    teachers: {
                        where: { subjectId },
                        include: { subject: true }
                    }
                }
            })

            for (const c of conflictClasses) {
                for (const t of c.teachers) {
                    conflicts.push({
                        classId: c.id,
                        className: classLabel(c.level, c.name),
                        teacherId: t.id,
                        teacherName: t.name || "Enseignant",
                        subjectName: t.subject?.name || "cette matière",
                    })
                }
            }
        }

        // Conflit non confirmé : on bloque et on renvoie le détail au client
        if (conflicts.length > 0 && !confirmReplace) {
            return NextResponse.json(
                { error: "CONFLICT", message: "Ces classes ont déjà un enseignant dans la même matière.", conflicts },
                { status: 409 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Photo par défaut si aucun fichier
        let photoName: string | null = null;
        if (!file || file.size === 0) {
            photoName = gender === 'f' ? 'femme.png' : 'homme.png';
        }

        // Nom de l'utilisateur connecté, pour le journal d'activité
        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value || "Inconnu");

        // --- Création dans une transaction ---
        const teacher = await prisma.$transaction(async (tx) => {
            // 1. Retirer la classe aux anciens enseignants de la même matière
            for (const c of conflicts) {
                await tx.teacher.update({
                    where: { id: c.teacherId },
                    data: { classes: { disconnect: { id: c.classId } } }
                })
            }

            // 2. Créer l'enseignant, son compte, et rattacher les classes
            const created = await tx.teacher.create({
                data: {
                    name,
                    iuense,
                    email,
                    phone,
                    gender,
                    diploma,
                    photo: photoName,
                    subjectId,
                    classes: classIds.length > 0
                        ? { connect: classIds.map((id) => ({ id })) }
                        : undefined,
                    user: {
                        create: {
                            login,
                            password: hashedPassword,
                            role: 'prof',
                        },
                    },
                },
                include: {
                    user: true,
                    classes: true,
                },
            })

            // 3. Journal d'activité
            let description = `a créé le professeur: ${created.name}.`
            if (classIds.length > 0) {
                description += ` Classes assignées: ${classIds.length}.`
            }
            if (conflicts.length > 0) {
                description += ` Remplacement: ${conflicts.map(c => `${c.className} (${c.teacherName})`).join(', ')}.`
            }
            await tx.activity.create({
                data: { nameUser: nameuser, description }
            })

            return created
        })

        // --- Photo, après la transaction ---
        if (file && file.size > 0) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const ext = path.extname(file.name);
            const filename = `${teacher.id}${ext}`;

            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'teachers');
            await mkdir(uploadDir, { recursive: true });
            await writeFile(path.join(uploadDir, filename), buffer);

            const updatedTeacher = await prisma.teacher.update({
                where: { id: teacher.id },
                data: { photo: `/uploads/teachers/${filename}` },
                include: { user: true, classes: true }
            });

            return NextResponse.json(updatedTeacher);
        }

        return NextResponse.json(teacher)
    } catch (error) {
        console.error("Error creating teacher:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la création" }, { status: 500 })
    }
}