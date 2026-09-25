import type { Prisma } from './generated/prisma/client';
import { enHeure, maintenant } from './emploi-du-temps';
import { libelleClasse } from './reservations';

type Tx = Prisma.TransactionClient;

const VERBES = { creation: "enregistré", modification: "modifié", suppression: "supprimé" } as const;

// Un enseignant a enregistré, modifié ou supprimé une répartition : alerte pour
// l'administration, dans la cloche du Topbar. Rien quand c'est l'administration.
//   « L'enseignante X a modifié une répartition pour la classe Y à 10:42 »
export async function alerterRepartition(
    tx: Tx,
    session: { role: string; userId: number },
    action: keyof typeof VERBES,
    planing: { id: number; teacherId: number | null; classId: number | null },
) {
    if (session.role !== "prof") return;

    // L'enseignant connecté ; à défaut, celui de la répartition
    const teacherId = session.userId || planing.teacherId;
    const teacher = teacherId
        ? await tx.teacher.findUnique({ where: { id: teacherId }, select: { name: true, gender: true } })
        : null;
    const classe = planing.classId
        ? await tx.class.findUnique({ where: { id: planing.classId }, select: { level: true, name: true } })
        : null;

    const qui = `${teacher?.gender === "f" ? "L'enseignante" : "L'enseignant"} ${teacher?.name || "inconnu"}`.trim();
    const pour = classe ? `pour la classe ${libelleClasse(classe).trim()}` : "(sans classe)";

    await tx.adminAlert.create({
        data: {
            type: `planing:${planing.id}`,
            message: `${qui} a ${VERBES[action]} une répartition ${pour} à ${enHeure(maintenant().minutes)}`,
        },
    });
}
