import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server'
import { notifyParentsOfClass } from '../../../lib/notifications';
import { dateValide } from '../../../lib/erreur-api';

export async function GET() {

    try {
        const tafs = await prisma.taf.findMany({
            orderBy: {
                dateTaf: 'desc'
            },
            include: {
                subject: true,
                class: true
            }
        })
        return NextResponse.json(tafs)
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch taf' }, { status: 500 });
    }
}

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const formData = await request.formData()

        const dateTaf = formData.get('dateTaf') as string
        const type = formData.get('type') as string
        const subjectId = formData.get('subjectId')
        const description = formData.get('description') as string
        const classId = formData.get('classId')
        const files = formData.getAll('files') as File[]

        if (!dateValide(dateTaf)) {
            return NextResponse.json({ error: "La date est obligatoire" }, { status: 400 })
        }
        if (!classId) {
            return NextResponse.json({ error: "La classe est obligatoire" }, { status: 400 })
        }
        if (!subjectId) {
            return NextResponse.json({ error: "La matière est obligatoire" }, { status: 400 })
        }

        const taf = await prisma.taf.create({
            data: {
                dateTaf: new Date(dateTaf),
                type,
                subjectId: subjectId ? Number(subjectId) : null,
                description,
                classId: classId ? Number(classId) : null
            }
        })

        // Handle File uploads
        if (files && files.length > 0) {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tafs');
            await mkdir(uploadDir, { recursive: true });

            for (const file of files) {
                if (file.size === 0) continue;

                const buffer = Buffer.from(await file.arrayBuffer());
                const originalName = file.name;
                const ext = path.extname(originalName);
                const uniqueName = `${taf.id}-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
                const filePath = path.join(uploadDir, uniqueName);

                await writeFile(filePath, buffer);

                await prisma.file.create({
                    data: {
                        name: uniqueName,
                        tafId: taf.id
                    }
                });
            }
        }

        // Send notification to parents of the class
        if (classId) {
            await notifyParentsOfClass(
                Number(classId),
                "Nouveau TAF/Devoir",
                (prenoms) => `Un nouveau devoir (${type}) a été ajouté${prenoms ? ` pour ${prenoms}` : ""} : ${description}`,
                "taf"
            );
        }

        // 1. Log Activity
        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value);
        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a créé le TAF/Devoir: ${taf.description}.`,
            }
        });

        return NextResponse.json(taf)
    } catch (error) {
        console.error("Error creating taf:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la création du TAF" }, { status: 500 })
    }
}
