import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { NextResponse } from 'next/server';
import { rattacherAuPrevenu } from '../../../../lib/absences-parent';
import { etatsAppel } from '../../../../lib/emploi-du-temps';

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

        if (!teacherId) {
            return NextResponse.json({ error: "L'enseignant est obligatoire" }, { status: 400 });
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
                student: { select: { firstName: true, lastName: true } },
                billet: { select: { id: true } },
            }
        });

        const incoming: { id: number; status: string; lateMinutes: number | null }[] =
            (absentStudents || []).map((st: any) => ({
                id: Number(st.id),
                status: st.status || "absence",
                lateMinutes: st.lateMinutes ? Number(st.lateMinutes) : null,
            }));

        // Un retard se compte en minutes entières
        const retardInvalide = incoming.find(st =>
            st.status === "retard" &&
            (!Number.isInteger(st.lateMinutes) || (st.lateMinutes as number) < 1 || (st.lateMinutes as number) > 240)
        );
        if (retardInvalide) {
            return NextResponse.json(
                { error: "Les minutes de retard doivent être un nombre entier entre 1 et 240" },
                { status: 400 }
            );
        }

        const incomingStudentIds = incoming.map(st => st.id);

        const etats = await etatsAppel(cid, String(dateAbsence).slice(0, 10), hour);

        // Une ligne d'où part un billet, ou celle d'un élève arrivé avec un billet
        // d'entrée sur ce créneau, reste au registre telle quelle : ni supprimée,
        // ni modifiée par un nouvel enregistrement de l'appel.
        const avecBillet = new Set([
            ...existingAbsences.filter(a => a.billet && a.studentId).map(a => a.studentId as number),
            ...Object.entries(etats).filter(([, e]) => e === "present_avec_billet").map(([id]) => Number(id)),
        ]);

        // Lignes à retirer : l'élève n'est plus signalé sur ce créneau
        const toDelete = existingAbsences.filter(
            a => a.studentId && !incomingStudentIds.includes(a.studentId) && !avecBillet.has(a.studentId)
        );
        const toDeleteIds = toDelete.map(a => a.id);

        // Lignes à créer ou à mettre à jour
        type LigneExistante = (typeof existingAbsences)[number];
        const parEleve = new Map<number, LigneExistante>();
        for (const a of existingAbsences) {
            if (a.studentId) parEleve.set(a.studentId, a);
        }
        const toCreateList = incoming.filter(st => !parEleve.has(st.id) && !avecBillet.has(st.id));
        const toUpdateList = incoming.filter(st => {
            const existant = parEleve.get(st.id);
            if (!existant || avecBillet.has(st.id)) return false;
            return existant.status !== st.status || (existant.lateMinutes ?? null) !== st.lateMinutes;
        });

        // Absences retirées alors qu'elles avaient déjà été signalées au parent
        const retireesDejaEnvoyees = toDelete.filter(a => a.validated === true);

        // Élèves « encore absents » que l'enseignant a laissés présents sans billet
        const revenusSansBillet = Object.entries(etats)
            .filter(([id, etat]) => etat === "encore_absent" && !incomingStudentIds.includes(Number(id)))
            .map(([id]) => Number(id));

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

                // Parent déjà prévenu de la journée : la nouvelle absence y est rattachée
                for (const st of toCreateList) {
                    if (st.status === "absence") await rattacherAuPrevenu(tx, st.id, targetDate);
                }

                // Une alerte par élève signalé, sauf si le parent est déjà prévenu
                const creees = await tx.absence.findMany({
                    where: {
                        classId: cid,
                        dateAbsence: targetDate,
                        hour: hour,
                        studentId: { in: toCreateList.map(st => st.id) },
                        parentNoticeId: null,
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

            // Devenue une absence : rattachement à l'envoi du jour s'il existe
            for (const st of toUpdateList) {
                if (st.status === "absence") await rattacherAuPrevenu(tx, st.id, targetDate);
            }

            // 3 bis. Élève absent plus tôt, déclaré présent sans billet d'entrée
            if (revenusSansBillet.length > 0) {
                const eleves = await tx.student.findMany({
                    where: { id: { in: revenusSansBillet } },
                    select: { id: true, firstName: true, lastName: true },
                });
                for (const e of eleves) {
                    const type = `sans-billet:${e.id}:${String(dateAbsence).slice(0, 10)}:${hour}`;
                    const deja = await tx.adminAlert.findFirst({ where: { type } });
                    if (deja) continue;
                    await tx.adminAlert.create({
                        data: {
                            type,
                            message:
                                `${nomClasse} — ${nomDe(e, e.id)}, absent plus tôt le ${dateFr}, a été déclaré présent ` +
                                `à ${creneau} par ${nameCookieStr} sans billet d'entrée.`,
                        }
                    });
                }
            }

            // 3 ter. L'appel est noté comme fait, même si aucun élève n'est signalé
            const nbSignales = await tx.absence.count({
                where: { classId: cid, dateAbsence: targetDate, hour: hour },
            });
            const appel = {
                hourEnd: hourEnd,
                teacherId: teacherId ? Number(teacherId) : null,
                faitPar: nameCookieStr,
                nbSignales,
                source: "saisie",
            };
            await tx.appel.upsert({
                where: { classId_date_hour: { classId: cid, date: targetDate, hour: hour } },
                create: { classId: cid, date: targetDate, hour: hour, ...appel },
                update: appel,
            });

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