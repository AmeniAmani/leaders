import { cookies } from 'next/headers';
import prisma from '../../../../lib/prisma';
import { erreurPaiement } from '../../../../lib/paiements';
import { NextResponse } from 'next/server'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const payment = await prisma.payment.findUnique({
        where: {
            id: Number(params.id)
        },
        include: {
            student: true,
            paymentLines: true
        }
    })
    return NextResponse.json(payment)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
    const params = await props.params;
    const json = await request.json()
    const paymentId = Number(params.id)

    const erreur = erreurPaiement(json)
    if (erreur) {
        return NextResponse.json({ error: erreur }, { status: 400 })
    }

    const payment = await prisma.payment.update({
        where: {
            id: paymentId
        },
        data: {
            num: json.num,
            as: json.as,
            studentId: Number(json.studentId) || null,
            paymentLines: {
                deleteMany: {},
                create: (json.paymentLines || []).map((line: any) => ({
                    amount: Number(line.amount),
                    title: line.title,
                    type: line.type,
                    numCheque: line.type === 'cheque' ? line.numCheque : null
                }))
            }
        },
        include: {
            paymentLines: true
        }
    })

    // Calculate total amount
    const totalAmount = payment.paymentLines.reduce((acc, line) => acc + line.amount, 0);

    // 1. Log Activity
    const cookiesStore = cookies();
    const nameuser= String((await cookiesStore).get('user-name')?.value);
    await prisma.activity.create({
        data: {
            nameUser: nameuser,
            description: `a modifié un payment (N° ${payment.num || payment.id}) de ${totalAmount} DT pour l'année scolaire ${payment.as}.`,
        }
    });
                
    return NextResponse.json(payment)
    } catch (error) {
        console.error("Error updating payment:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la modification du paiement" }, { status: 500 })
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const payment = await prisma.payment.delete({
        where: {
            id: Number(params.id)
        },
        include: {
            paymentLines: true
        }
    })

    // Calculate total amount
    const totalAmount = payment.paymentLines.reduce((acc, line) => acc + line.amount, 0);

    // 1. Log Activity
    const cookiesStore = cookies();
    const nameuser= String((await cookiesStore).get('user-name')?.value);
    await prisma.activity.create({
        data: {
            nameUser: nameuser,
            description: `a supprimé un payment (N° ${payment.num || payment.id}) de ${totalAmount} DT pour l'année scolaire ${payment.as}.`,
        }
    });
    return NextResponse.json(payment)
}
