import  prisma  from '../../../../lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import path from 'path';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const student = await prisma.student.findUnique({
        where: {
            id: Number(params.id)
        },
        include: {
            classe: true,
            parent: true
        }
    })

    return NextResponse.json(student)
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
    const { id } = await params;
    const formData = await request.formData();

    // Extract fields
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const idenelev = formData.get('idenelev') as string
    const birthday = formData.get('birthday') as string
    const classId = formData.get('classId') ? parseInt(formData.get('classId') as string) : null
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null
    const file = formData.get('photo') as File | null
    //const status = formData.get('status') as string
    const address = formData.get('address') as string
    const phone = formData.get('phone') as string
    const gender = formData.get('gender') as string

    if (!firstName || !firstName.trim()) {
        return NextResponse.json({ error: "Le prénom de l'élève est obligatoire" }, { status: 400 })
    }
    if (!lastName || !lastName.trim()) {
        return NextResponse.json({ error: "Le nom de l'élève est obligatoire" }, { status: 400 })
    }
    if (!classId) {
        return NextResponse.json({ error: "La classe est obligatoire" }, { status: 400 })
    }

    const existant = await prisma.student.findUnique({
        where: { id: parseInt(id) },
        select: { parentId: true, photo: true }
    })
    if (!existant) {
        return NextResponse.json({ error: "Élève introuvable" }, { status: 404 })
    }
    // Parent obligatoire, mais une fiche encore sans parent reste modifiable :
    // on refuse seulement de retirer un parent déjà attribué.
    if (!parentId && existant.parentId) {
        return NextResponse.json({ error: "Le parent ou tuteur est obligatoire" }, { status: 400 })
    }

    // Sans nouvelle photo, on garde la photo actuelle ; seule l'image par défaut
    // suit le genre choisi.
    let photoName = existant.photo;
    if (!file || file.size === 0) {
        if (!photoName || photoName === 'fille.jfif' || photoName === 'garcon.jfif') {
            photoName = gender === 'f' ? 'fille.jfif' : 'garcon.jfif';
        }
    }

    const student = await prisma.student.update({
        where: {
            id: parseInt(id),
        },
        data: {
            firstName: firstName,
            lastName: lastName,
            birthday: birthday ? new Date(birthday) : null,
            idenelev: idenelev,
            classId: classId ? Number(classId) : null,
            parentId: parentId ? Number(parentId) : null,
            photo: photoName,
            status: null,
            address: address,
            phone: phone,
            gender: gender
        }
    })

    // 1. Log Activity
        const cookiesStore = cookies();
        const name= String((await cookiesStore).get('user-name')?.value);
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a modifié l'élève ${student.firstName} ${student.lastName}`,
            }
        });

    // 2. Handle File Upload if exists
    if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name;
        const ext = path.extname(originalName);
        const filename = `${student.id}${ext}`; // ID as filename

        // Ensure directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'students');
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        // 3. Update Student with new photo path
        const updatedStudent = await prisma.student.update({
            where: { id: student.id },
            data: {
                photo: `/uploads/students/${filename}`
            }
        });

        return NextResponse.json(updatedStudent);
    }

    return NextResponse.json(student)
    } catch (error) {
        console.error("Erreur mise à jour élève:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la mise à jour de l'élève" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    const student = await prisma.student.delete({
        where: {
            id: Number(params.id)
        }
    })

    // 1. Log Activity
        const cookiesStore = cookies();
        const name= String((await cookiesStore).get('user-name')?.value);
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a supprimé l'élève ${student.firstName} ${student.lastName}`,
            }
        });

    return NextResponse.json(student)
}
