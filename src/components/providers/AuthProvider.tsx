'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useBoardStore } from '@/store/useBoardStore';
import { useRouter } from 'next/navigation';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const setUser = useBoardStore(state => state.setUser);
    const setIsPrivateMode = useBoardStore(state => state.setIsPrivateMode);
    const setConnectionState = useBoardStore(state => state.setConnectionState);

    useEffect(() => {
        const supabase = createClient();

        // Check active session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                setIsPrivateMode(true);
            }
        });

        // Listen for auth changes (like Google OAuth callback or logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN' && session?.user) {
                    setUser(session.user);
                    setIsPrivateMode(true);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setIsPrivateMode(false);
                    // Force refresh to clear state and disconnect private network
                    router.replace('/');
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [router, setUser, setIsPrivateMode, setConnectionState]);

    return <>{children}</>;
}
