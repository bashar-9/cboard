'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { sendPrivateItem } from '@/hooks/usePrivateNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, Trash2, File as FileIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const MAX_FILE_SIZE_PUBLIC = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE_PRIVATE = 4 * 1024 * 1024; // 4MB

export function ShareInput() {
    const { sharePost } = useBoardNetwork();
    const { connectionState, isPrivateMode, user } = useBoardStore();
    const [inputText, setInputText] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const maxLimit = isPrivateMode ? MAX_FILE_SIZE_PRIVATE : MAX_FILE_SIZE_PUBLIC;
        const validFiles = files.filter(file => {
            if (file.size > maxLimit) {
                toast.error(`File ${file.name} is too large. Max size is ${isPrivateMode ? '4MB' : '50MB'}.`);
                return false;
            }
            return true;
        });
        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }
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
        const files = Array.from(e.dataTransfer.files || []);
        const maxLimit = isPrivateMode ? MAX_FILE_SIZE_PRIVATE : MAX_FILE_SIZE_PUBLIC;
        const validFiles = files.filter(file => {
            if (file.size > maxLimit) {
                toast.error(`File ${file.name} is too large. Max size is ${isPrivateMode ? '4MB' : '50MB'}.`);
                return false;
            }
            return true;
        });
        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }
    };

    const handleShare = () => {
        if (!inputText.trim() && selectedFiles.length === 0) return;

        if (isPrivateMode) {
            if (!user) {
                toast.error("You must be logged in to use Private Mode.");
                return;
            }
            sendPrivateItem(inputText, selectedFiles);
        } else {
            sharePost(inputText, selectedFiles);
        }

        setInputText('');
        setSelectedFiles([]);
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
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
            <div className="max-w-3xl mx-auto px-3 pb-4 pt-2 pointer-events-auto">
                {/* File chips — above the bar */}
                <AnimatePresence>
                    {selectedFiles.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="flex flex-wrap gap-2 mb-2"
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
                        placeholder="Share something with the board..."
                        rows={1}
                        className="flex-1 resize-none border-0 bg-transparent py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none leading-relaxed min-h-[44px] max-h-[120px]"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleShare();
                            }
                        }}
                    />

                    {/* Send */}
                    <Button
                        onClick={handleShare}
                        disabled={(!inputText.trim() && selectedFiles.length === 0) || connectionState !== 'connected'}
                        className="h-10 w-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:shadow-none shrink-0 mr-1 mb-1 p-0"
                        title="Share (⌘ + Enter)"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>

                {/* Subtle hint */}
                <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-1.5 select-none">
                    Drop files or press ⌘ + Enter to share
                </p>
            </div>
        </div>
    );
}
