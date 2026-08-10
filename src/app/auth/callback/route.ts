import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PRIVATE_MODE_ENABLED } from '@/lib/features';

export async function GET(request: Request) {
    if (!PRIVATE_MODE_ENABLED) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(new URL(next, request.url));
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url));
}
