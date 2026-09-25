import  prisma  from '../../../../lib/prisma';
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await prisma.user.findUnique({
    where: {
      login: params.id
    }
  })
  return NextResponse.json(user)
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
  const params = await props.params;
  const json = await request.json()

  let dataToUpdate: any = {
    login: json.login,
    role: json.role,
    active: json.active,
  };

  if (json.password) {
    dataToUpdate.password = await bcrypt.hash(json.password, 10);
  }

  const user = await prisma.user.update({
    where: {
      login: params.id
    },
    data: dataToUpdate
  })

  // 1. Log Activity
      const cookiesStore = cookies();
      const nameuser= String((await cookiesStore).get('user-name')?.value);
      await prisma.activity.create({
          data: {
              nameUser: nameuser,
              description: `a modifié l'utilisateur: ${user.login}.`,
          }
      });
  return NextResponse.json(user)
  } catch (error: any) {
    console.error("Erreur modification utilisateur:", error)
    // login est la clé de la table : la base refuse déjà un doublon
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: "Cet identifiant est déjà utilisé" }, { status: 400 })
    }
    return NextResponse.json({ error: "Une erreur est survenue lors de la modification de l'utilisateur" }, { status: 500 })
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await prisma.user.delete({
    where: {
      login: params.id
    }
  })
  // 1. Log Activity
    const cookiesStore = cookies();
    const nameuser= String((await cookiesStore).get('user-name')?.value);
    await prisma.activity.create({
        data: {
            nameUser: nameuser,
            description: `a supprimé l'utilisateur: ${user.login}.`,
        }
    });
  return NextResponse.json(user)
}