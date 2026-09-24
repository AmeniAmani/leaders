import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Handle CORS for mobile API
    if (pathname.startsWith('/api/mobile/')) {
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Parent-Id',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        const response = NextResponse.next();
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Parent-Id');
        return response;
    }

    const authToken = request.cookies.get('auth-token');
    // Sans session, « espace-connexion » (posé à la déconnexion) choisit la page de connexion
    const userRole = request.cookies.get('user-role')?.value
        ?? (request.cookies.get('espace-connexion')?.value === 'prof' ? 'prof' : undefined);

    // Pages de connexion publiques : /login (admin) et /prof (enseignant)
    const isPublicRoute = pathname === '/login' || pathname === '/prof';

    if (!isPublicRoute && !authToken) {
        const url = request.nextUrl.clone();
        // Un enseignant revient sur sa propre page de connexion
        url.pathname = userRole === 'prof' ? '/prof' : '/login';
        return NextResponse.redirect(url);
    }

    // Redirect to dashboard if logged in and trying to access a login page
    if (isPublicRoute && authToken) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|img.jpg|logo.png).*)',
        '/api/mobile/:path*',
    ],
};