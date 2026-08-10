import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'
import { PRIVATE_MODE_ENABLED } from './lib/features'

export default async function proxy(request: NextRequest) {
    // Private cloud session handling is intentionally inactive in local-only mode.
    if (!PRIVATE_MODE_ENABLED) return NextResponse.next()

    const { updateSession } = await import('./lib/supabase/middleware')
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
