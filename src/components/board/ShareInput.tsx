'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, Lock, Send, Paperclip, File as FileIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const MAX_FILE_SIZE_PUBLIC = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;
const MAX_TEXT_LENGTH = 10_000;

export function ShareInput() {
    const { sharePost } = useBoardNetwork();
    const { localRoomPrivacy, roomSessions } = useBoardStore();
    const connectionState = roomSessions[localRoomPrivacy].connectionState;
    const [inputText, setInputText] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    const autoResize = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }, []);

    useEffect(() => {
        autoResize();
    }, [inputText, autoResize]);

    const addFiles = (files: File[]) => {
        const availableSlots = Math.max(0, MAX_FILES - selectedFiles.length);
        const validFiles = files.slice(0, availableSlots).filter(file => {
            if (file.size > MAX_FILE_SIZE_PUBLIC) {
                toast.error(`File ${file.name} is too large. Maximum size is 50 MB.`);
                return false;
            }
            return true;
        });
        if (files.length > availableSlots) toast.error(`You can share up to ${MAX_FILES} files at once.`);
        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        addFiles(Array.from(e.target.files || []));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        addFiles(Array.from(e.dataTransfer.files || []));
    };

    const handleShare = async () => {
        if (!inputText.trim() && selectedFiles.length === 0) return;
        setIsSharing(true);
        try {
            const shared = await sharePost(inputText, selectedFiles);
            if (shared) {
                setInputText('');
                setSelectedFiles([]);
                if (textareaRef.current) textareaRef.current.style.height = 'auto';
            }
        } catch {
            toast.error('Sharing failed. Check the local connection and try again.');
        } finally {
            setIsSharing(false);
        }
    };

    const removeSelectedFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div
            className="fixed bottom-0 inset-x-0 z-40 pointer-events-none"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="pointer-events-auto mx-auto max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
                <div className="mb-1.5 flex justify-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border bg-white/90 px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-xl dark:bg-slate-900/90 ${localRoomPrivacy === 'private' ? 'border-indigo-200 text-indigo-600 dark:border-indigo-500/30 dark:text-indigo-400' : 'border-emerald-200 text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-400'}`}>
                        {localRoomPrivacy === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        Sending to {localRoomPrivacy === 'private' ? 'Private' : 'Public'}
                    </span>
                </div>
                {/* File chips — above the bar */}
                <AnimatePresence>
                    {selectedFiles.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="mb-2 flex gap-2 overflow-x-auto pb-1"
                        >
                            {selectedFiles.map((file, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-1.5 bg-slate-800/90 dark:bg-slate-700/90 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-xl border border-slate-700/50 dark:border-slate-600/50"
                                >
                                    <FileIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span className="truncate max-w-[120px]">{file.name}</span>
                                    <span className="text-slate-400 text-[10px] shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                    <button
                                        onClick={() => removeSelectedFile(index)}
                                        className="ml-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input bar */}
                <div
                    className={`flex items-end gap-2 rounded-2xl border transition-all duration-300 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/40 ${isDragging
                        ? 'bg-indigo-500/20 border-indigo-500/50 ring-2 ring-indigo-500/30'
                        : 'bg-white/90 dark:bg-slate-800/90 border-slate-200/60 dark:border-slate-700/60'
                        }`}
                >
                    {/* Attach */}
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer shrink-0 ml-1 mb-1"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach file"
                    >
                        <Paperclip className="w-5 h-5" />
                    </Button>

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        maxLength={MAX_TEXT_LENGTH}
                        placeholder="Type or drop a file"
                        rows={1}
                        className="max-h-36 min-h-11 flex-1 resize-none border-0 bg-transparent py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                void handleShare();
                            }
                        }}
                    />

                    {/* Send */}
                    <Button
                        onClick={() => void handleShare()}
                        disabled={(!inputText.trim() && selectedFiles.length === 0) || connectionState !== 'connected' || isSharing}
                        className="h-10 w-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:shadow-none shrink-0 mr-1 mb-1 p-0"
                        title="Send (Enter)"
                    >
                        {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>

                {/* Subtle hint */}
                <p className="mt-1.5 hidden select-none text-center text-[10px] text-slate-400 dark:text-slate-600 sm:block">
                    Enter to send · Shift + Enter for a new line
                </p>
            </div>
        </div>
    );
}
