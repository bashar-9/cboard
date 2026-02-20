'use client';

import { SharedItem } from '@/store/useBoardStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { Button } from '@/components/ui/button';
import { X, Copy, Trash2, CheckCircle2, Clock, Timer, Download, File as FileIcon, DownloadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function ExpiresIn({ expiresAt }: { expiresAt: number }) {
    const [mins, setMins] = useState<number | null>(null);
    useEffect(() => {
        const update = () => setMins(Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)));
        update();
        const i = setInterval(update, 60000);
        return () => clearInterval(i);
    }, [expiresAt]);
    if (mins === null || mins <= 0) return null;
    return (
        <span className="flex items-center gap-0.5">
            <span>·</span>
            <Timer className="w-3 h-3" />
            <span>{mins}m</span>
        </span>
    );
}

interface ItemDetailModalProps {
    item: SharedItem;
    onClose: () => void;
}

export function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
    const { myId } = useBoardStore();
    const { deleteItem } = useBoardNetwork();
    const [copied, setCopied] = useState(false);
    const isMine = item.senderId === myId;

    const handleCopy = () => {
        navigator.clipboard.writeText(item.content);
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDelete = () => {
        deleteItem(item.id);
        toast.success('Item deleted');
        onClose();
    };

    const handleDownloadAll = () => {
        const attachments = item.attachments?.filter(a => a.fileData) || [];
        attachments.forEach(att => {
            const a = document.createElement('a');
            a.href = att.fileData!;
            a.download = att.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
        toast.success(`Downloading ${attachments.length} files`);
    };

    // Close on Escape
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [handleKeyDown]);

    const hasContent = item.content && item.content.trim().length > 0;
    const attachments = item.attachments || [];
    const downloadableAttachments = attachments.filter(a => a.fileData);

    // For legacy 'file' type items
    const isLegacyFile = item.type === 'file';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="relative w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-2xl overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center gap-2 text-[12px] text-slate-400 dark:text-slate-500">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isMine ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'}`}>
                                {isMine ? 'Y' : 'S'}
                            </div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{isMine ? 'You' : 'Someone'}</span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                            <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {item.expiresAt && <ExpiresIn expiresAt={item.expiresAt} />}
                        </div>
                        <div className="flex items-center gap-1">
                            {hasContent && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 rounded-lg cursor-pointer transition-all ${copied ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    onClick={handleCopy}
                                    title="Copy text"
                                >
                                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            )}
                            {isMine && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg cursor-pointer transition-all"
                                    onClick={handleDelete}
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-all"
                                onClick={onClose}
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                        {/* Text content */}
                        {hasContent && (
                            <p className="text-[14px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                                {item.content}
                            </p>
                        )}

                        {/* Legacy file type */}
                        {isLegacyFile && (
                            <a
                                href={item.fileData || '#'}
                                download={item.fileName}
                                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.mimeType?.startsWith('image/') && item.fileData ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={item.fileData} alt="preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <FileIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.fileName}</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                        {item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown size'}
                                    </span>
                                </div>
                                <Download className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                            </a>
                        )}

                        {/* Attachments */}
                        {attachments.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Attachments ({attachments.length})
                                    </span>
                                    {downloadableAttachments.length >= 2 && (
                                        <button
                                            onClick={handleDownloadAll}
                                            className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                        >
                                            <DownloadCloud className="w-3.5 h-3.5" />
                                            Download All
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    {attachments.map(att => (
                                        <a
                                            key={att.id}
                                            href={att.fileData || '#'}
                                            download={att.fileName}
                                            className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group/file"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                                                {att.mimeType?.startsWith('image/') && att.fileData ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img src={att.fileData} alt="preview" className="w-full h-full object-cover rounded" />
                                                ) : (
                                                    <FileIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{att.fileName}</span>
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                    {att.fileSize ? (att.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '...'}
                                                </span>
                                            </div>
                                            <Download className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover/file:text-indigo-500 dark:group-hover/file:text-indigo-400 transition-colors shrink-0" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
