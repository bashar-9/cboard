import { useEffect, useRef } from 'react';
import { useBoardStore, SharedItem } from '@/store/useBoardStore';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

export function usePrivateNetworkInit() {
    const isPrivateMode = useBoardStore(state => state.isPrivateMode);
    const user = useBoardStore(state => state.user);
    const setConnectionState = useBoardStore(state => state.setConnectionState);
    const addPrivateItem = useBoardStore(state => state.addPrivateItem);
    const setPrivateItems = useBoardStore(state => state.setPrivateItems);
    const deletePrivateItem = useBoardStore(state => state.deletePrivateItem);
    const clearPrivateItems = useBoardStore(state => state.clearPrivateItems);
    const addDebugLog = useBoardStore(state => state.addDebugLog);

    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!isPrivateMode || !user) {
            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            clearPrivateItems();
            return;
        }

        const supabase = createClient();
        setConnectionState('connecting');
        addDebugLog('Connecting to Supabase Realtime...');

        // 1. Fetch existing non-expired items from DB
        const fetchInitialData = async () => {
            const { data, error } = await supabase
                .from('private_items')
                .select('*')
                .eq('user_id', user.id)
                .gte('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (error) {
                addDebugLog(`Error fetching private items: ${error.message}`);
                return;
            }

            if (data && data.length > 0) {
                const parsedItems: SharedItem[] = data.map(row => {
                    let attachments = [];
                    if (row.file_url) {
                        attachments.push({
                            id: row.id + '-att',
                            fileName: row.file_name || 'file',
                            fileSize: 0,
                            mimeType: row.file_type || 'application/octet-stream',
                            fileData: row.file_url
                        });
                    }

                    return {
                        id: row.id,
                        type: row.file_url ? 'post' : 'text',
                        scope: 'private',
                        content: row.content,
                        attachments: attachments.length > 0 ? attachments : undefined,
                        senderId: 'Me',
                        timestamp: new Date(row.created_at).getTime(),
                        expiresAt: new Date(row.expires_at).getTime(),
                    };
                });
                setPrivateItems(parsedItems);
            }
        };

        fetchInitialData();

        // 2. Subscribe to realtime inserts and deletes
        channelRef.current = supabase
            .channel(`private-user-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'private_items',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const row = payload.new;
                    let attachments = [];
                    if (row.file_url) {
                        attachments.push({
                            id: row.id + '-att',
                            fileName: row.file_name || 'file',
                            fileSize: 0,
                            mimeType: row.file_type || 'application/octet-stream',
                            fileData: row.file_url
                        });
                    }

                    const newItem: SharedItem = {
                        id: row.id,
                        type: row.file_url ? 'post' : 'text',
                        scope: 'private',
                        content: row.content,
                        attachments: attachments.length > 0 ? attachments : undefined,
                        senderId: 'Me',
                        timestamp: new Date(row.created_at).getTime(),
                        expiresAt: new Date(row.expires_at).getTime(),
                    };
                    addPrivateItem(newItem);
                    addDebugLog(`Received private item: ${row.id}`);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'private_items',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    deletePrivateItem(payload.old.id);
                    addDebugLog(`Deleted private item: ${payload.old.id}`);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setConnectionState('connected');
                    addDebugLog('Subscribed to private sync channel.');
                }
            });

        return () => {
            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
        };
    }, [isPrivateMode, user, addDebugLog, addPrivateItem, setPrivateItems, deletePrivateItem, clearPrivateItems, setConnectionState]);
}

export const sendPrivateItem = async (content: string, files?: File[]) => {
    const { user, addDebugLog, addPrivateItem } = useBoardStore.getState();
    if (!user) return;
    const supabase = createClient();

    let file_url = null;
    let file_name = null;
    let file_type = null;

    // Handle first file if it exists
    if (files && files.length > 0) {
        const file = files[0];
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('private_files')
            .upload(filePath, file);

        if (error) {
            addDebugLog(`Storage error: ${error.message}`);
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('private_files')
            .getPublicUrl(filePath);

        file_url = publicUrl;
        file_name = file.name;
        file_type = file.type;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { data: insertedData, error } = await supabase.from('private_items').insert({
        user_id: user.id,
        content: content || (files && files.length > 0 ? 'Shared File' : ''),
        file_url,
        file_name,
        file_type,
        expires_at: expiresAt.toISOString()
    }).select().single();

    if (error) {
        addDebugLog(`Db insert error: ${error.message}`);
        toast.error("Failed to save to private cloud.");
        return;
    }

    if (insertedData) {
        let attachments = [];
        if (insertedData.file_url) {
            attachments.push({
                id: insertedData.id + '-att',
                fileName: insertedData.file_name || 'file',
                fileSize: 0, // Real size is on storage, could grab it if needed
                mimeType: insertedData.file_type || 'application/octet-stream',
                fileData: insertedData.file_url
            });
        }

        const newItem: SharedItem = {
            id: insertedData.id,
            type: insertedData.file_url ? 'post' : 'text',
            scope: 'private',
            content: insertedData.content,
            attachments: attachments.length > 0 ? attachments : undefined,
            senderId: 'Me',
            timestamp: new Date(insertedData.created_at).getTime(),
            expiresAt: new Date(insertedData.expires_at).getTime(),
        };

        // Optimistically add to store so the user sees it instantly
        addPrivateItem(newItem);
    }
};

export const deletePrivateItemFromDb = async (id: string) => {
    const { user, addDebugLog, deletePrivateItem } = useBoardStore.getState();
    if (!user) return;

    // Optimistic UI Update: remove from standard view instantly
    deletePrivateItem(id);

    const supabase = createClient();
    const { error } = await supabase.from('private_items').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
        addDebugLog(`Db delete error: ${error.message}`);
        toast.error("Failed to delete from private cloud.");
    }
};
