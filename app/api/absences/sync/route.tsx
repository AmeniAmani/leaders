import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';

function libelleClasse(level: string | null, name: string | null) {
    if (level === "1") return "السابعة أساسي " + name
    if (level === "2") return "الثامنة أساسي " + name
    if (level === "3") return "التاسعة أساسي " + name
    return String(name ?? "")
}

// Message d'alerte pour un élève : absence, retard ou exclusion
function messageAlerte(p: {
    status: string | null;
    lateMinutes: number | null;
    nomEleve: string;
    nomClasse: string;
    dateFr: string;
    hour: string;
    hourEnd: string;
    nomProf: string | null;
}) {
    const quoi =
        p.status === "exclusion" ? "Exclusion" :
        p.status === "retard" ? (p.lateMinutes ? `Retard de ${p.lateMinutes} min` : "Retard") :
        "Absence";
    const prof = p.nomProf ? ` — cours de ${p.nomProf}` : "";
    return `${quoi} : ${p.nomEleve} (${p.nomClasse}) le ${p.dateFr} de ${p.hour} à ${p.hourEnd}${prof}.`;
}

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const { classId, dateAbsence, hour, hourEnd, teacherId, absentStudents } = json;

        if (!classId || !dateAbsence || !hour) {
            return NextResponse.json({ error: "Classe, date et heure de début sont obligatoires" }, { status: 400 });
        }

        if (!hourEnd) {
            return NextResponse.json({ error: "L'heure de fin est obligatoire" }, { status: 400 });
        }

        if (String(hourEnd) <= String(hour)) {
            return NextResponse.json(
                { error: "L'heure de fin doit être postérieure à l'heure de début" },
                { status: 400 }
            );
        }

        const cid = Number(classId);
        const targetDate = new Date(dateAbsence);
        const dateFr = targetDate.toLocaleDateString('fr-FR');
        const creneau = `${hour} - ${hourEnd}`;

        // Nom lisible de la classe
        const classe = await prisma.class.findUnique({
            where: { id: cid },
            select: { name: true, level: true }
        });
        const nomClasse = classe ? libelleClasse(classe.level, classe.name) : `classe ID ${classId}`;

        // Nom de l'enseignant et de sa matière
        const prof = teacherId
            ? await prisma.teacher.findUnique({
                where: { id: Number(teacherId) },
                select: { name: true, subject: { select: { name: true } } }
            })
            : null;
        const nomProf = prof?.name
            ? (prof.subject?.name ? `${prof.name} (${prof.subject.name})` : prof.name)
            : null;

        // Absences déjà enregistrées pour cette classe, cette date et cette heure
        const existingAbsences = await prisma.absence.findMany({
            where: {
                classId: cid,
                dateAbsence: targetDate,
                hour: hour,
            },
            include: {
                student: { select: { firstName: true, lastName: true } }
            }
        });

        const incoming: { id: number; status: string; lateMinutes: number | null }[] =
            (absentStudents || []).map((st: any) => ({
                id: Number(st.id),
                status: st.status || "absence",
                lateMinutes: st.lateMinutes ? Number(st.lateMinutes) : null,
            }));

        const incomingStudentIds = incoming.map(st => st.id);

        // Lignes à retirer : l'élève n'est plus signalé sur ce créneau
        const toDelete = existingAbsences.filter(
            a => a.studentId && !incomingStudentIds.includes(a.studentId)
        );
        const toDeleteIds = toDelete.map(a => a.id);

        // Lignes à créer ou à mettre à jour
        type LigneExistante = (typeof existingAbsences)[number];
        const parEleve = new Map<number, LigneExistante>();
        for (const a of existingAbsences) {
            if (a.studentId) parEleve.set(a.studentId, a);
        }
        const toCreateList = incoming.filter(st => !parEleve.has(st.id));
        const toUpdateList = incoming.filter(st => {
            const existant = parEleve.get(st.id);
            if (!existant) return false;
            return existant.status !== st.status || (existant.lateMinutes ?? null) !== st.lateMinutes;
        });

        // Absences retirées alors qu'elles avaient déjà été signalées au parent
        const retireesDejaEnvoyees = toDelete.filter(a => a.validated === true);

        const cookiesStore = cookies();
        const nameCookieStr = String((await cookiesStore).get('user-name')?.value || "Inconnu");

        const nomDe = (s: { firstName: string | null; lastName: string | null } | null, id: number | null) =>
            s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : `élève ID ${id}`;

        await prisma.$transaction(async (tx) => {
            // 1. Retirer les lignes qui ne sont plus d'actualité, et fermer leurs alertes
            if (toDeleteIds.length > 0) {
                await tx.absence.deleteMany({ where: { id: { in: toDeleteIds } } });
                await tx.adminAlert.updateMany({
                    where: { type: { in: toDeleteIds.map(id => `absence:${id}`) }, read: false },
                    data: { read: true, readAt: new Date() }
                });
            }

            // 2. Créer les nouvelles lignes, en attente d'envoi aux parents
            if (toCreateList.length > 0) {
                await tx.absence.createMany({
                    data: toCreateList.map((st) => ({
                        studentId: st.id,
                        classId: cid,
                        dateAbsence: targetDate,
                        hour: hour,
                        hourEnd: hourEnd,
                        status: st.status,
                        lateMinutes: st.lateMinutes,
                        teacherId: teacherId ? Number(teacherId) : null,
                        validated: false,
                    }))
                });

                // Une alerte par élève signalé
                const creees = await tx.absence.findMany({
                    where: {
                        classId: cid,
                        dateAbsence: targetDate,
                        hour: hour,
                        studentId: { in: toCreateList.map(st => st.id) },
                    },
                    include: { student: { select: { firstName: true, lastName: true } } }
                });

                await tx.adminAlert.createMany({
                    data: creees.map(a => ({
                        type: `absence:${a.id}`,
                        message: messageAlerte({
                            status: a.status,
                            lateMinutes: a.lateMinutes,
                            nomEleve: nomDe(a.student, a.studentId),
                            nomClasse,
                            dateFr,
                            hour,
                            hourEnd,
                            nomProf,
                        }),
                    }))
                });
            }

            // 3. Mettre à jour celles dont le type a changé, et leur alerte
            for (const st of toUpdateList) {
                const existant = parEleve.get(st.id);
                if (!existant) continue;
                await tx.absence.update({
                    where: { id: existant.id },
                    data: { status: st.status, lateMinutes: st.lateMinutes }
                });

                const message = messageAlerte({
                    status: st.status,
                    lateMinutes: st.lateMinutes,
                    nomEleve: nomDe(existant.student, existant.studentId),
                    nomClasse,
                    dateFr,
                    hour,
                    hourEnd,
                    nomProf,
                }) + " (signalement modifié)";

                const ouverte = await tx.adminAlert.findFirst({
                    where: { type: `absence:${existant.id}`, read: false }
                });
                if (ouverte) {
                    await tx.adminAlert.update({
                        where: { id: ouverte.id },
                        data: { message, createdAt: new Date() }
                    });
                } else {
                    await tx.adminAlert.create({
                        data: { type: `absence:${existant.id}`, message }
                    });
                }
            }

            // 4. Journal d'activité
            const details: string[] = [];
            if (toCreateList.length > 0) details.push(`${toCreateList.length} ajoutée(s)`);
            if (toUpdateList.length > 0) details.push(`${toUpdateList.length} modifiée(s)`);
            if (toDeleteIds.length > 0) details.push(`${toDeleteIds.length} retirée(s)`);

            await tx.activity.create({
                data: {
                    nameUser: nameCookieStr,
                    description:
                        `a mis à jour l'appel (${nomClasse}) du ${dateFr} à ${creneau}` +
                        (details.length > 0 ? ` — ${details.join(', ')}.` : '.'),
                }
            });

            // 5. Signalement retiré alors qu'il avait déjà été transmis au parent
            for (const a of retireesDejaEnvoyees) {
                const nomEleve = nomDe(a.student, a.studentId);
                await tx.activity.create({
                    data: {
                        nameUser: nameCookieStr,
                        description:
                            `⚠️ a retiré le signalement de ${nomEleve} du ${dateFr} à ${creneau}, ` +
                            `alors qu'il avait DÉJÀ été transmis au parent.`,
                    }
                });
                await tx.adminAlert.create({
                    data: {
                        type: "absence-retrait",
                        message:
                            `${nomClasse} — ${nameCookieStr} a retiré le signalement de ${nomEleve} ` +
                            `(${dateFr}, ${creneau}) alors qu'il avait déjà été transmis au parent.`,
                    }
                });
            }
        });

        return NextResponse.json({
            success: true,
            newAbsencesCount: toCreateList.length,
            updatedAbsencesCount: toUpdateList.length,
            deletedAbsencesCount: toDeleteIds.length,
            deletedAlreadySentCount: retireesDejaEnvoyees.length,
        });
    } catch (error) {
        console.error("Error syncing absences:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de la synchronisation" }, { status: 500 });
    }
}