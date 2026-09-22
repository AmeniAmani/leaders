import { cookies } from 'next/headers';
import prisma from '../../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

const MAX_TAILLE = 10 * 1024 * 1024; // 10 Mo

const estAdmin = async () => {
    const store = await cookies();
    return String(store.get('user-role')?.value || "") === 'admin';
};

const nomUtilisateur = async () => {
    const store = await cookies();
    return String(store.get('user-name')?.value || "Inconnu");
};

// Liste des pièces du dossier
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const studentId = Number(params.id);
        if (isNaN(studentId)) {
            return NextResponse.json({ error: "Identifiant élève invalide" }, { status: 400 });
        }

        const documents = await prisma.studentDocument.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(documents);
    } catch (error) {
        console.error("Erreur liste documents:", error);
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
    }
}

// Ajout d'une pièce
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        if (!await estAdmin()) {
            return NextResponse.json({ error: "Action réservée à l'administration" }, { status: 403 });
        }

        const params = await props.params;
        const studentId = Number(params.id);
        if (isNaN(studentId)) {
            return NextResponse.json({ error: "Identifiant élève invalide" }, { status: 400 });
        }

        const student = await prisma.student.findUnique({ where: { id: studentId } });
        if (!student) {
            return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        }

        const formData = await request.formData();
        const nom = String(formData.get('name') || "").trim();
        const file = formData.get('file') as File | null;

        if (!nom) {
            return NextResponse.json({ error: "Donnez un nom au document" }, { status: 400 });
        }
        if (!file || file.size === 0) {
            return NextResponse.json({ error: "Sélectionnez un fichier" }, { status: 400 });
        }
        if (file.size > MAX_TAILLE) {
            return NextResponse.json({ error: "Le fichier dépasse 10 Mo" }, { status: 400 });
        }

        // Nom de fichier unique, extension d'origine conservée
        const ext = path.extname(file.name) || "";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

        const dossier = path.join(process.cwd(), 'public', 'uploads', 'students', String(studentId), 'documents');
        await mkdir(dossier, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(dossier, fileName), buffer);

        const filePath = `/uploads/students/${studentId}/documents/${fileName}`;

        const nameuser = await nomUtilisateur();

        const document = await prisma.$transaction(async (tx) => {
            const cree = await tx.studentDocument.create({
                data: {
                    studentId,
                    name: nom,
                    fileName: file.name,
                    filePath,
                    mimeType: file.type || null,
                    size: file.size,
                }
            });

            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a ajouté le document « ${nom} » au dossier de ${student.firstName || ''} ${student.lastName || ''}`.trim() + ".",
                }
            });

            return cree;
        });

        return NextResponse.json(document);
    } catch (error) {
        console.error("Erreur ajout document:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de l'envoi" }, { status: 500 });
    }
}

// Suppression d'une pièce
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        if (!await estAdmin()) {
            return NextResponse.json({ error: "Action réservée à l'administration" }, { status: 403 });
        }

        const params = await props.params;
        const studentId = Number(params.id);
        const { documentId } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: "documentId requis" }, { status: 400 });
        }

        const document = await prisma.studentDocument.findUnique({
            where: { id: Number(documentId) },
            include: { student: { select: { firstName: true, lastName: true } } }
        });

        if (!document || document.studentId !== studentId) {
            return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
        }

        const nameuser = await nomUtilisateur();

        await prisma.$transaction(async (tx) => {
            await tx.studentDocument.delete({ where: { id: document.id } });
            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a supprimé le document « ${document.name} » du dossier de ${document.student?.firstName || ''} ${document.student?.lastName || ''}`.trim() + ".",
                }
            });
        });

        // Le fichier sur disque est retiré après coup : son absence
        // ne doit pas empêcher la suppression en base.
        try {
            await unlink(path.join(process.cwd(), 'public', document.filePath));
        } catch (e) {
            console.warn("Fichier déjà absent du disque:", document.filePath);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur suppression document:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la suppression" }, { status: 500 });
    }
}