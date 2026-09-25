import  prisma  from '../../../lib/prisma';
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function GET() {
    const users = await prisma.user.findMany()
    return NextResponse.json(users)
}

export async function POST(request: Request) {
    try {
    const json = await request.json()
    if (!json.login || !json.password ) {
        return NextResponse.json(
            { error: "L'identifiant et le mot de passe sont obligatoires" },
            { status: 400 }
        )
    }
    const hashedPassword = await bcrypt.hash(json.password, 10);
    const user = await prisma.user.create({
        //data: json
        data: {
            login: json.login,
            password: hashedPassword,
            role: json.role,
            active: json.active,
            idTeach: json.idTeach || null,
        }
    })

    // 1. Log Activity
    const cookiesStore = cookies();
    const nameuser= String((await cookiesStore).get('user-name')?.value);
    await prisma.activity.create({
        data: {
            nameUser: nameuser,
            description: `a créé l'utilisateur: ${user.login}.`,
        }
    });

    return NextResponse.json(user)
    } catch (error: any) {
        console.error("Erreur création utilisateur:", error)
        // login est la clé de la table : la base refuse déjà un doublon
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: "Cet identifiant est déjà utilisé" }, { status: 400 })
        }
        return NextResponse.json({ error: "Une erreur est survenue lors de la création de l'utilisateur" }, { status: 500 })
    }
}
