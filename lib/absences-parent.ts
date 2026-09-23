import type { Prisma } from './generated/prisma/client';

// Une absence = une notification au parent par élève et par jour.
// ParentAbsenceNotice (unique sur élève + jour) mémorise cet envoi ; toutes les
// lignes d'absence de la journée y sont rattachées, y compris celles saisies après.

type Tx = Prisma.TransactionClient;

// Rattache à l'envoi du jour, s'il existe déjà, les absences de l'élève qui ne
// le sont pas encore. Aucune notification n'est créée. Renvoie les lignes rattachées.
export async function rattacherAuPrevenu(tx: Tx, studentId: number, date: Date) {
    const prevenu = await tx.parentAbsenceNotice.findUnique({
        where: { studentId_date: { studentId, date } },
    });
    if (!prevenu) return [];

    const lignes = await tx.absence.findMany({
        where: { studentId, dateAbsence: date, status: "absence", parentNoticeId: null },
        select: { id: true },
    });
    if (lignes.length === 0) return [];

    const ids = lignes.map(l => l.id);
    await tx.absence.updateMany({
        where: { id: { in: ids } },
        data: { parentNoticeId: prevenu.id, validated: true, validatedAt: new Date() },
    });
    // Le parent est déjà prévenu : ces lignes n'attendent plus d'envoi
    await tx.adminAlert.updateMany({
        where: { type: { in: ids.map(id => `absence:${id}`) }, read: false },
        data: { read: true, readAt: new Date() },
    });
    return ids;
}
