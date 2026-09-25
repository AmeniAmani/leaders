import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server'

import { writeFile, mkdir, unlink } from 'fs/promises';
import { dateValide } from '../../../../lib/erreur-api';
import path from 'path';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const taf = await prisma.taf.findUnique({
        where: {
            id: Number(params.id)
        },
        include: {
            subject: true,
            class: true,
            files: true
        }
    })
    return NextResponse.json(taf)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const formData = await request.formData()

        const dateTaf = formData.get('dateTaf') as string
        const type = formData.get('type') as string
        const subjectId = formData.get('subjectId')
        const description = formData.get('description') as string
        const classId = formData.get('classId')
        const newFiles = formData.getAll('files') as File[]
        const filesToDelete = formData.getAll('filesToDelete') as string[] // IDs of files to delete

        if (!dateValide(dateTaf)) {
            return NextResponse.json({ error: "La date est obligatoire" }, { status: 400 })
        }
        if (!classId) {
            return NextResponse.json({ error: "La classe est obligatoire" }, { status: 400 })
        }
        if (!subjectId) {
            return NextResponse.json({ error: "La matière est obligatoire" }, { status: 400 })
        }

        const taf = await prisma.taf.update({
            where: {
                id: Number(params.id)
            },
            data: {
                dateTaf: new Date(dateTaf),
                type,
                subjectId: subjectId ? Number(subjectId) : null,
                description,
                classId: classId ? Number(classId) : null,
            }
        })

        // Handle File deletions
        if (filesToDelete && filesToDelete.length > 0) {
            for (const fileId of filesToDelete) {
                const fileRecord = await prisma.file.findUnique({
                    where: { id: Number(fileId) }
                });

                if (fileRecord && fileRecord.name) {
                    const filePath = path.join(process.cwd(), 'public', 'uploads', 'tafs', fileRecord.name);
                    try {
                        await unlink(filePath);
                    } catch (e) {
                        console.error(`Failed to delete file from disk: ${fileRecord.name}`, e);
                    }
                    await prisma.file.delete({
                        where: { id: Number(fileId) }
                    });
                }
            }
        }

        // Handle New File uploads
        if (newFiles && newFiles.length > 0) {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tafs');
            await mkdir(uploadDir, { recursive: true });

            for (const file of newFiles) {
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

        // 1. Log Activity
        const cookiesStore = cookies();
        const nameuser = String((await cookiesStore).get('user-name')?.value);
        await prisma.activity.create({
            data: {
                nameUser: nameuser,
                description: `a modifié le TAF/Devoir: ${taf.description}.`,
            }
        });

        return NextResponse.json(taf)
    } catch (error) {
        console.error("Error updating taf:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la modification du TAF" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const taf = await prisma.taf.delete({
        where: {
            id: Number(params.id)
        }
    })

    // 1. Log Activity
    const cookiesStore = cookies();
    const nameuser= String((await cookiesStore).get('user-name')?.value);
    await prisma.activity.create({
        data: {
            nameUser: nameuser,
            description: `a supprimé le TAF/Devoir: ${taf.description}.`,
        }
    });
    return NextResponse.json(taf)
}
