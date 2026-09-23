import { cookies } from 'next/headers';
import  prisma  from '../../../../lib/prisma';
import { NextResponse } from 'next/server'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const absenceItem = await prisma.absence.findUnique({
        where: {
            id: Number(params.id)
        },
        include: {
            student: true,
        }
    })
    return NextResponse.json(absenceItem)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const json = await request.json()

    const updatedabsence = await prisma.absence.update({
        where: {
            id: Number(params.id)
        },
        data: {
            studentId: Number(json.studentId),
            classId: Number(json.classId),
            dateAbsence: new Date(json.dateAbsence),
            hour: json.hour,
        }
    })
    // 1. Log Activity
        const cookiesStore = cookies();
        const name= String((await cookiesStore).get('user-name')?.value);
        const namestud = json.studentName; 
        await prisma.activity.create({
            data: {
                nameUser: name,
                description: `a modifié l'absence de l'élève: ${namestud}`,
            }
        });
    return NextResponse.json(updatedabsence)
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const deletedabsence = await prisma.absence.delete({
        where: {
            id: Number(params.id)
        }
    })
    // 1. Log Activity
            const cookiesStore = cookies();
            const name= String((await cookiesStore).get('user-name')?.value);
            const student= await prisma.student.findUnique({
                where: {
                    id: Number(deletedabsence.studentId)
                }
            });
            const namestud = student?.firstName + " " + student?.lastName;
            await prisma.activity.create({
                data: {
                    nameUser: name,
                    description: `a supprimé l'absence de l'élève: ${namestud}`,
                }
            });
    return NextResponse.json(deletedabsence)
}
