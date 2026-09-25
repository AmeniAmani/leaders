import  prisma  from '../../../lib/prisma';
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers';
import { trierParents } from '../../../lib/parents';

export async function GET() {
    const parents = await prisma.parent.findMany({
        include: {
            childrenIds: true
        }
    })
    // Par nom de famille (voir lib/parents.ts)
    return NextResponse.json(trierParents(parents))
}

export async function POST(request: Request) {
    try {
        const json = await request.json()

        const { name1, relation1, email1, phone1, name2, relation2, email2, phone2, username, password } = json

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null

        const parent = await prisma.parent.create({
            data: {
                name1,
                relation1,
                email1,
                phone1,
                name2,
                relation2,
                email2,
                phone2,
                username,
                password: hashedPassword,
            }
        })

        // 1. Log Activity
            const cookiesStore = cookies();
            const nameuser= String((await cookiesStore).get('user-name')?.value);
            await prisma.activity.create({
                data: {
                    nameUser: nameuser,
                    description: `a créé le parent ${parent.name1}`,
                }
            });
            
        return NextResponse.json(parent)
    } catch (error) {
        console.error("Error creating parent:", error)
        return NextResponse.json({ error: "Failed to create parent" }, { status: 500 })
    }
}
