import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { NextResponse } from 'next/server'
import { matieresDesSignalements } from '../../../lib/emploi-du-temps';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const classIdStr = searchParams.get('classId');
    const dateStr = searchParams.get('date');
    const hourStr = searchParams.get('hour');
    const teacherIdStr = searchParams.get('teacherId');

    if (classIdStr && dateStr && hourStr) {
        const classId = Number(classIdStr);
        const dateAbsence = new Date(dateStr);
        const absences = await prisma.absence.findMany({
            where: {
                classId,
                dateAbsence,
                hour: hourStr
            },
            include: {
                student: true
            }
        });
        return NextResponse.json(absences);
    }

    // Année scolaire en cours : de septembre à juin
    const month = new Date().getMonth() + 1;
    let date1 = "";
    let date2 = "";
    if (month >= 9) {
        date1 = new Date().getFullYear() + "-09-01";
        date2 = (new Date().getFullYear() + 1) + "-06-30";
    }
    else {
        date1 = (new Date().getFullYear() - 1) + "-09-01";
        date2 = (new Date().getFullYear()) + "-06-30";
    }

    const where: any = {
        dateAbsence: {
            gte: new Date(date1),
            lte: new Date(date2),
        }
    };

    if (teacherIdStr) {
        where.teacherId = Number(teacherIdStr);
    }

    const absence = await prisma.absence.findMany({
        where,
        orderBy: {
            dateAbsence: 'desc'
        },
        include: {
            student: true,
            classe: true,
            // Enseignant qui a fait le signalement
            teacher: { select: { id: true, name: true, subject: { select: { name: true } } } },
            // Billet émis depuis cette ligne, et les enseignants qui l'ont reçu
            billet: {
                select: {
                    id: true, type: true, hour: true, hourEnd: true, createdAt: true,
                    statut: true, traiteAt: true, traitePar: true,
                    notifications: { select: { teacher: { select: { name: true } } } },
                }
            },
            parentNotice: { select: { id: true, sentAt: true } },
        }
    })

    // Matière du cours signalé, d'après l'emploi du temps ; à défaut, celle de la fiche enseignant
    const matieres = await matieresDesSignalements(absence);
    return NextResponse.json(absence.map((a, i) => ({
        ...a,
        matiere: matieres[i] || a.teacher?.subject?.name || null,
    })))
}

export async function POST(request: Request) {
    try {
        const json = await request.json()

        // L'absence est créée en attente : c'est l'administration qui l'envoie
        // au parent depuis la page Absences.
        const newabsence = await prisma.absence.create({
            data: {
                studentId: Number(json.studentId),
                classId: Number(json.classId),
                dateAbsence: new Date(json.dateAbsence),
                hour: json.hour,
                hourEnd: json.hourEnd || null,
                teacherId: json.teacherId ? Number(json.teacherId) : null,
                validated: false,
            }
        })

        // Journal d'activité
        const cookiesStore = cookies();
        const name = String((await cookiesStore).get('user-name')?.value || "Inconnu");
        const namestud = json.studentName;
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a ajouté l'absence de l'élève: ${namestud}`,
            }
        });
        return NextResponse.json(newabsence)
    } catch (error) {
        console.error("Error creating absence:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la création" }, { status: 500 })
    }
}