import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { enregistrerAppareil } from '../../../../../lib/appareils';

export async function POST(request: Request) {
    try {
        const { username, password, pushToken, platform } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
        }

        const parent = await prisma.parent.findFirst({
            where: { username }
        });

        if (!parent) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        if (parent.active === false) {
            return NextResponse.json({ error: "Votre compte est désactivé. Veuillez contacter l'administration." }, { status: 403 });
        }

        const passwordMatch = parent.password ? await bcrypt.compare(password, parent.password) : false;

        if (!passwordMatch) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Téléphone inscrit aux notifications push : seulement ici, après vérification du mot de passe
        const push = await enregistrerAppareil(parent.id, pushToken, platform);

        // In a real app, you'd return a JWT here. 
        // For this task, we'll return the parent info.
        return NextResponse.json({
            id: parent.id,
            name: parent.name1,
            username: parent.username,
            push
        });
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
