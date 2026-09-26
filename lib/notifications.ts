import prisma from './prisma';
import { isoler } from './bidi';

// Prénom de l'élève pour les messages aux parents (un parent peut avoir
// plusieurs enfants). À défaut de prénom, le nom ; sinon null. Isolé (prénom arabe).
export function prenomEleve(eleve: { firstName?: string | null; lastName?: string | null } | null | undefined): string | null {
    const nom = eleve?.firstName?.trim() || eleve?.lastName?.trim();
    return nom ? isoler(nom) : null;
}

// « enfant Yasmine », ou « enfant » sans prénom : s'écrit « Votre ${enfant(p)} ».
export const enfant = (prenom: string | null) => prenom ? `enfant ${prenom}` : "enfant";

// « Yasmine », « Yasmine et Adam », « Yasmine, Adam et Sami »
export function listePrenoms(prenoms: string[]): string {
    if (prenoms.length <= 1) return prenoms[0] || "";
    return `${prenoms.slice(0, -1).join(', ')} et ${prenoms[prenoms.length - 1]}`;
}

// Parents des élèves des classes données, avec les prénoms de leurs enfants concernés.
export async function prenomsParParent(classIds: number[]): Promise<Map<number, string[]>> {
    const students = await prisma.student.findMany({
        where: { classId: { in: classIds }, parentId: { not: null } },
        select: { parentId: true, firstName: true, lastName: true },
        orderBy: [{ firstName: 'asc' }, { id: 'asc' }]
    });

    const parents = new Map<number, string[]>();
    for (const s of students) {
        const prenoms = parents.get(s.parentId!) || [];
        const prenom = prenomEleve(s);
        if (prenom && !prenoms.includes(prenom)) prenoms.push(prenom);
        parents.set(s.parentId!, prenoms);
    }
    return parents;
}

export async function createNotification(parentId: number, title: string, message: string, type: string) {
    try {
        await prisma.notification.create({
            data: {
                parentId,
                title,
                message,
                type,
            }
        });
    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

export async function notifyParentsOfStudent(studentId: number, title: string, message: string, type: string) {
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { parentId: true }
    });

    if (student?.parentId) {
        await createNotification(student.parentId, title, message, type);
    }
}

// Un message par parent, construit avec les prénoms de ses enfants de la classe.
export async function notifyParentsOfClass(classId: number, title: string, message: (prenoms: string) => string, type: string) {
    const parents = await prenomsParParent([classId]);

    for (const [parentId, prenoms] of parents) {
        await createNotification(parentId, title, message(listePrenoms(prenoms)), type);
    }
}

export async function notifyAllParents(title: string, message: string, type: string) {
    const parents = await prisma.parent.findMany({
        select: { id: true }
    });

    for (const parent of parents) {
        await createNotification(parent.id, title, message, type);
    }
}
