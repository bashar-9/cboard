'use client';

import { useState, useRef } from 'react';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Trash2, File as FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function ShareInput() {
    const { sharePost } = useBoardNetwork();
    const { connectionState } = useBoardStore();
    const [inputText, setInputText] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);

        const validFiles = files.filter(file => {
            if (file.size > MAX_FILE_SIZE) {
                toast.error(`File ${file.name} is too large. Max size is 50MB.`);
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

        const validFiles = files.filter(file => {
            if (file.size > MAX_FILE_SIZE) {
                toast.error(`File ${file.name} is too large. Max size is 50MB.`);
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

        // Use sharePost hook to dispatch event
        sharePost(inputText, selectedFiles);

        setInputText('');
        setSelectedFiles([]);
    };

    const removeSelectedFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="space-y-4"
        >
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-700 pointer-events-none"></div>
                <div
                    className={`relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[1.5rem] border ${isDragging ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200/60 dark:border-slate-800/60'} shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-indigo-500/50 dark:focus-within:ring-indigo-400/50 transition-all duration-300`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Internal Glass Highlight */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent pointer-events-none" />

                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <Textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type or drop files here to share with the network..."
                        className="w-full min-h-[160px] resize-none border-0 shadow-none focus-visible:ring-0 p-6 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-transparent text-slate-800 dark:text-slate-200 leading-relaxed"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleShare();
                            }
                        }}
                    />
                    <div className="bg-slate-50/50 dark:bg-slate-900/80 p-3 flex flex-col gap-3 transition-colors duration-200">
                        {/* File Preview Chips */}
                        {selectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-3 pb-2 mb-1 border-b border-slate-200/50 dark:border-slate-800/50">
                                {selectedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-100 dark:border-indigo-500/20 max-w-full">
                                        <FileIcon className="w-4 h-4 shrink-0" />
                                        <span className="truncate max-w-[150px]">{file.name}</span>
                                        <span className="text-indigo-400 dark:text-indigo-500 text-xs shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                        <button
                                            onClick={() => removeSelectedFile(index)}
                                            className="ml-1 text-indigo-400 hover:text-indigo-600 dark:text-indigo-500 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center w-full">
                            <div className="flex items-center gap-2 ml-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach file"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </Button>
                                <div className="hidden sm:flex items-center justify-center w-6 h-6 rounded bg-slate-200/50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-2">⌘</div>
                                <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500 font-medium">+ Enter to send</span>
                            </div>
                            <Button
                                onClick={handleShare}
                                disabled={(!inputText.trim() && selectedFiles.length === 0) || connectionState !== 'connected'}
                                className="rounded-xl px-6 h-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-50 hover:text-white cursor-pointer transition-all duration-300 shadow-md font-semibold"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Share to Board
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
