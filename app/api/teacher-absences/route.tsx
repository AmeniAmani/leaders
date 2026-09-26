import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { isoler } from '../../../lib/bidi';
import { NextResponse } from 'next/server';
import { listePrenoms, prenomsParParent } from '../../../lib/notifications';
import { envoyerPush } from '../../../lib/push';

const classLabel = (level: string | null, name: string | null) => {
    const prefix =
        level === "1" ? "السابعة أساسي " :
        level === "2" ? "الثامنة أساسي " :
        level === "3" ? "التاسعة أساسي " : "";
    return prefix + (name || "");
};

const fr = (d: Date) => new Date(d).toLocaleDateString('fr-FR');

export async function GET() {
    const absences = await prisma.teacherAbsence.findMany({
        orderBy: { dateStart: 'desc' },
        include: {
            teacher: { include: { subject: true } },
            classes: true,
        }
    });
    return NextResponse.json(absences);
}

export async function POST(request: Request) {
    try {
        const { teacherId, dateStart, dateEnd, hourStart, hourEnd, reason, classIds } = await request.json();

        const cookiesStore = cookies();
        const store = await cookiesStore;
        const role = String(store.get('user-role')?.value || "");
        const nameuser = String(store.get('user-name')?.value || "Inconnu");

        if (role !== 'admin') {
            return NextResponse.json(
                { error: "Seule l'administration peut déclarer l'absence d'un enseignant" },
                { status: 403 }
            );
        }

        if (!teacherId || !dateStart || !dateEnd) {
            return NextResponse.json({ error: "Enseignant et dates obligatoires" }, { status: 400 });
        }

        const debut = new Date(dateStart);
        const fin = new Date(dateEnd);

        if (fin < debut) {
            return NextResponse.json(
                { error: "La date de fin ne peut pas précéder la date de début" },
                { status: 400 }
            );
        }

        // Absence sur quelques heures : une seule journée, heures obligatoires
        const surHeures = Boolean(hourStart && hourEnd);
        if (surHeures) {
            if (debut.getTime() !== fin.getTime()) {
                return NextResponse.json(
                    { error: "Une absence sur quelques heures ne peut concerner qu'une seule journée" },
                    { status: 400 }
                );
            }
            if (String(hourEnd) <= String(hourStart)) {
                return NextResponse.json(
                    { error: "L'heure de fin doit être postérieure à l'heure de début" },
                    { status: 400 }
                );
            }
        }

        const ids: number[] = Array.isArray(classIds)
            ? classIds.map((v: any) => Number(v)).filter((v: number) => !isNaN(v))
            : [];

        if (ids.length === 0) {
            return NextResponse.json({ error: "Sélectionnez au moins une classe" }, { status: 400 });
        }

        const teacher = await prisma.teacher.findUnique({
            where: { id: Number(teacherId) },
            include: { subject: true }
        });

        if (!teacher) {
            return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }

        // Parents des élèves des classes concernées, sans doublon, avec les prénoms de leurs enfants
        const parents = await prenomsParParent(ids);
        const parentIds = Array.from(parents.keys());

        // Message envoyé aux familles
        const matiere = teacher.subject?.name ? `, professeur de ${isoler(teacher.subject.name)},` : ",";
        const periode = surHeures
            ? `le ${fr(debut)} de ${hourStart} à ${hourEnd}`
            : debut.getTime() === fin.getTime()
                ? `le ${fr(debut)}`
                : `du ${fr(debut)} au ${fr(fin)}`;
        const message =
            `${teacher.name || "Un enseignant"}${matiere} sera absent(e) ${periode}.` +
            (reason ? ` Motif : ${reason}.` : "");

        const classes = await prisma.class.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, level: true }
        });
        const nomsClasses = classes.map(c => isoler(classLabel(c.level, c.name))).join(', ');

        // Un message par parent, avec les prénoms de ses enfants concernés
        const notifications = Array.from(parents, ([parentId, { prenoms }]) => ({
            parentId,
            title: "Absence enseignant",
            message: prenoms.length === 0 ? message
                : `${message} ${prenoms.length > 1 ? "Enfants concernés" : "Enfant concerné"} : ${listePrenoms(prenoms)}.`,
            type: "absence",
        }));

        const created = await prisma.$transaction(async (tx) => {
            const absence = await tx.teacherAbsence.create({
                data: {
                    teacherId: Number(teacherId),
                    dateStart: debut,
                    dateEnd: fin,
                    hourStart: surHeures ? String(hourStart) : null,
                    hourEnd: surHeures ? String(hourEnd) : null,
                    reason: reason || null,
                    notifiedAt: parentIds.length > 0 ? new Date() : null,
                    classes: { connect: ids.map((id) => ({ id })) }
                },
                include: {
                    teacher: { include: { subject: true } },
                    classes: true,
                }
            });

            // Une seule requête pour toutes les notifications
            if (notifications.length > 0) {
                await tx.notification.createMany({ data: notifications });
            }

            await tx.activity.create({
                data: {
                    nameUser: nameuser,
                    description:
                        `a déclaré l'absence de ${teacher.name || "un enseignant"} ${periode} ` +
                        `(${nomsClasses}) — ${parentIds.length} parent(s) prévenu(s).`,
                }
            });

            return absence;
        });

        // Push après l'enregistrement : les notifications sont en base
        envoyerPush(notifications.map(n => ({ parentId: n.parentId, title: n.title, body: n.message, type: n.type })));

        return NextResponse.json({
            success: true,
            absence: created,
            notifiedParents: parentIds.length,
        });
    } catch (error) {
        console.error("Error creating teacher absence:", error);
        return NextResponse.json({ error: "Une erreur est survenue lors de l'enregistrement" }, { status: 500 });
    }
}