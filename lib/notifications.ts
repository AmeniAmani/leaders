import prisma from './prisma';
import { isoler } from './bidi';
import { envoyerPush, type EnvoiPush } from './push';

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

// Parents des élèves des classes données, avec les prénoms de leurs enfants concernés
// et le premier de ces enfants (page ouverte en touchant la notification push).
export async function prenomsParParent(classIds: number[]): Promise<Map<number, { prenoms: string[]; studentId: number }>> {
    const students = await prisma.student.findMany({
        where: { classId: { in: classIds }, parentId: { not: null } },
        select: { id: true, parentId: true, firstName: true, lastName: true },
        orderBy: [{ firstName: 'asc' }, { id: 'asc' }]
    });

    const parents = new Map<number, { prenoms: string[]; studentId: number }>();
    for (const s of students) {
        const parent = parents.get(s.parentId!) || { prenoms: [], studentId: s.id };
        const prenom = prenomEleve(s);
        if (prenom && !parent.prenoms.includes(prenom)) parent.prenoms.push(prenom);
        parents.set(s.parentId!, parent);
    }
    return parents;
}

// Enregistre la notification ; renvoie false si l'écriture a échoué.
async function enregistrer(parentId: number, title: string, message: string, type: string): Promise<boolean> {
    try {
        await prisma.notification.create({
            data: {
                parentId,
                title,
                message,
                type,
            }
        });
        return true;
    } catch (error) {
        console.error("Error creating notification:", error);
        return false;
    }
}

// Enregistre la notification, puis l'envoie en push sur les téléphones du parent.
export async function createNotification(parentId: number, title: string, message: string, type: string, studentId?: number | null) {
    if (await enregistrer(parentId, title, message, type)) {
        envoyerPush([{ parentId, title, body: message, type, studentId }]);
    }
}

export async function notifyParentsOfStudent(studentId: number, title: string, message: string, type: string) {
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { parentId: true }
    });

    if (student?.parentId) {
        await createNotification(student.parentId, title, message, type, studentId);
    }
}

// Un message par parent, construit avec les prénoms de ses enfants de la classe.
export async function notifyParentsOfClass(classId: number, title: string, message: (prenoms: string) => string, type: string) {
    const parents = await prenomsParParent([classId]);
    const envois: EnvoiPush[] = [];

    for (const [parentId, { prenoms, studentId }] of parents) {
        const body = message(listePrenoms(prenoms));
        if (await enregistrer(parentId, title, body, type)) {
            envois.push({ parentId, title, body, type, studentId });
        }
    }
    envoyerPush(envois);
}

export async function notifyAllParents(title: string, message: string, type: string) {
    const parents = await prisma.parent.findMany({
        select: { id: true }
    });
    const envois: EnvoiPush[] = [];

    for (const parent of parents) {
        if (await enregistrer(parent.id, title, message, type)) {
            envois.push({ parentId: parent.id, title, body: message, type });
        }
    }
    envoyerPush(envois);
}
