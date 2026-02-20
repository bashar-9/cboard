'use client';

import { useState, useEffect } from 'react';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { useBoardStore, SharedItem } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Copy, Clock, Timer, Trash2, CheckCircle2, Download, File as FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function ExpiresIn({ expiresAt }: { expiresAt: number }) {
    const [mins, setMins] = useState<number | null>(null);

    useEffect(() => {
        const updateTime = () => setMins(Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)));
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    if (mins === null || mins <= 0) return null;

    return (
        <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
            <span>•</span>
            <Timer className="w-3 h-3" />
            <span>{mins}m</span>
        </span>
    );
}

interface BoardItemCardProps {
    item: SharedItem;
}

export function BoardItemCard({ item }: BoardItemCardProps) {
    const { deleteItem } = useBoardNetwork();
    const { myId } = useBoardStore();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = (id: string) => {
        deleteItem(id);
        toast.success('Item deleted');
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)", transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="group relative"
        >
            {/* Glowing Aura Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-200/50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-700/30 rounded-[1.8rem] blur-lg opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none"></div>

            <Card className="relative overflow-hidden rounded-[1.5rem] border border-white/60 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl">
                {/* Top Glass Highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent pointer-events-none" />

                <CardHeader className="px-6 pt-6 pb-2 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border ${item.senderId === myId ? 'bg-slate-900 text-white border-slate-700 dark:bg-white dark:text-slate-900 dark:border-slate-200' : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                            {item.senderId === myId ? 'Y' : 'S'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight leading-none mb-1">
                                {item.senderId === myId ? 'You' : 'Someone'}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {item.expiresAt && <ExpiresIn expiresAt={item.expiresAt} />}
                            </div>
                        </div>
                    </div>

                    {/* Delete Option - Show only if I sent it */}
                    {item.senderId === myId && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl cursor-pointer transition-all duration-200"
                            onClick={() => handleDelete(item.id)}
                            title="Delete globally"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="p-6">
                    {item.type === 'post' ? (
                        <div className="bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 shadow-inner flex flex-col gap-4 transition-colors">
                            {item.content && (
                                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-words font-sans text-[15px]">
                                    {item.content}
                                </p>
                            )}
                            {item.attachments && item.attachments.length > 0 && (
                                <div className="flex flex-col gap-3 mt-1">
                                    {item.attachments.map(att => (
                                        <div key={att.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                                                    {att.mimeType?.startsWith('image/') && att.fileData ? (
                                                        /* eslint-disable-next-line @next/next/no-img-element */
                                                        <img src={att.fileData} alt="preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate pr-4">{att.fileName}</span>
                                                    <span className="text-xs font-medium text-slate-500 mt-0.5">
                                                        {att.fileSize ? (att.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '...'}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                className="shrink-0 h-9 w-9 p-0 rounded-full bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-500/20 text-slate-700 dark:text-slate-300 transition-colors shadow-sm cursor-pointer"
                                                asChild
                                            >
                                                <a href={att.fileData || '#'} download={att.fileName}>
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : item.type === 'file' ? (
                        <div className="bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 shadow-inner flex items-center justify-between transition-colors">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                                    {item.mimeType?.startsWith('image/') && item.fileData ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={item.fileData} alt="preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <FileIcon className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">{item.fileName}</span>
                                    <span className="text-xs font-medium text-slate-500 mt-0.5">
                                        {item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown size'}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                className="shrink-0 h-10 w-10 p-0 rounded-full bg-slate-200/50 hover:bg-indigo-100 dark:bg-slate-800/80 dark:hover:bg-indigo-500/20 text-slate-700 dark:text-slate-300 transition-colors shadow-sm cursor-pointer"
                                asChild
                            >
                                <a href={item.fileData || '#'} download={item.fileName}>
                                    <Download className="w-5 h-5" />
                                </a>
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 shadow-inner">
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-words font-sans text-[15px]">
                                {item.content}
                            </p>
                        </div>
                    )}
                </CardContent>

                {item.type === 'text' && (
                    <CardFooter className="px-6 pb-6 pt-0">
                        <Button
                            variant="secondary"
                            className={`w-full h-11 rounded-xl font-semibold tracking-wide transition-all duration-300 shadow-sm cursor-pointer ${copiedId === item.id ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 dark:hover:border-slate-600'}`}
                            onClick={() => copyToClipboard(item.id, item.content)}
                        >
                            {copiedId === item.id ? (
                                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center">
                                    <CheckCircle2 className="w-4 h-4 mr-2.5" />
                                    Copied into clipboard
                                </motion.div>
                            ) : (
                                <div className="flex items-center">
                                    <Copy className="w-4 h-4 mr-2.5 text-slate-400 dark:text-slate-500" />
                                    Copy to clipboard
                                </div>
                            )}
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </motion.div>
    );
}
