import { cookies } from 'next/headers';
import prisma from '../../../lib/prisma';
import { erreurPaiement } from '../../../lib/paiements';
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const p = searchParams.get("p")
  const as = searchParams.get("as")

  try {  
    if (p && as) {
        // cas : /route?p=2&as=2024/2025
        const whereClause: any = {};

        if (p !== "all") {
            whereClause.studentId = Number(p)
        }
        if (as !== "all") {
            whereClause.as = as
        }

        const payments = await prisma.payment.findMany({
            where: {
                ...whereClause
            },
            include: {
                paymentLines: true
            }
        });

        // Group by studentId and as, summing up amounts from lines
        const totalsMap = new Map<string, number>();
        payments.forEach(pay => {
            const key = `${pay.studentId || 0}-${pay.as || ''}`;
            const sum = pay.paymentLines.reduce((acc, line) => acc + (line.amount || 0), 0);
            totalsMap.set(key, (totalsMap.get(key) || 0) + sum);
        });

        const total = Array.from(totalsMap.entries()).map(([key, amount]) => {
            const [studentId, as] = key.split('-');
            return {
                studentId: studentId !== "0" ? Number(studentId) : null,
                as: as || null,
                _sum: {
                    amount
                }
            };
        });

        return NextResponse.json(total);
    }
    const payments = await prisma.payment.findMany({
        include: {
            student: true,
            paymentLines: true
        }
    })
    return NextResponse.json(payments)
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const json = await request.json()

        const { num, studentId, as, paymentLines } = json

        const erreur = erreurPaiement(json)
        if (erreur) {
            return NextResponse.json({ error: erreur }, { status: 400 })
        }

        const payment = await prisma.payment.create({
            data: {
                num,
                studentId: Number(studentId) || null,
                as,
                paymentLines: {
                    create: (paymentLines || []).map((line: any) => ({
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
                description: `a créé un payment (N° ${payment.num || payment.id}) de ${totalAmount} DT pour l'année scolaire ${payment.as}.`,
            }
        });
                
        return NextResponse.json(payment)
    } catch (error) {
        console.error("Error creating payment:", error)
        return NextResponse.json({ error: "Une erreur est survenue lors de la création du paiement" }, { status: 500 })
    }
}
