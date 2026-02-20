'use client';

import { useState, useEffect, useRef } from 'react';
import { useBoardNetwork } from '@/hooks/useBoardNetwork';
import { useBoardStore } from '@/store/useBoardStore';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Copy, Users, WifiOff, Send, Clock, Timer, Trash2, CheckCircle2, Sparkles, Paperclip, Download, File as FileIcon } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

export default function Home() {
  const { sharePost, error, deleteItem } = useBoardNetwork();
  const { connectionState, peers, items, incomingFiles, myId, roomCode, debugLogs } = useBoardStore();
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

    sharePost(inputText, selectedFiles);

    setInputText('');
    setSelectedFiles([]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-indigo-200 dark:selection:bg-indigo-900 transition-colors duration-300 relative overflow-hidden">

      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-500/15 dark:via-purple-500/5 dark:to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-0 z-50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between transition-colors duration-300 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 flex items-center justify-center font-bold text-lg transition-all duration-300 shadow-lg border border-slate-700 dark:border-white/20">
            C
          </div>
          <h1 className="font-bold tracking-tight text-xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Board</h1>
        </div>

        <div className="flex items-center gap-3 text-sm font-medium">
          <ThemeToggle />
          {connectionState === 'connected' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-full border border-green-200/50 dark:border-green-500/20 transition-colors duration-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>{peers.length} Connected</span>
            </div>
          ) : connectionState === 'connecting' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200/50 dark:border-amber-500/20 transition-colors duration-200">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              Connecting...
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-full border border-red-200/50 dark:border-red-500/20 transition-colors duration-200">
              <WifiOff className="w-3 h-3" />
              Offline
            </div>
          )}
        </div>
      </motion.header>

      <main className="max-w-3xl mx-auto w-full p-6 space-y-10 pt-10">

        {/* Input Area */}
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
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-red-500 font-medium px-2"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Board Feed */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-800/50 mb-6"
          >
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              LIVE BOARD
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">ROOM: {roomCode ? roomCode.substring(0, 8) : '...'}</span>
            </div>
          </motion.div>

          {/* Incoming Files Progress */}
          {Object.values(incomingFiles).length > 0 && (
            <div className="space-y-3 mb-6">
              {Object.values(incomingFiles).map(file => (
                <div key={file.id} className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 flex flex-col gap-2 shadow-sm">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                      <Download className="w-4 h-4 animate-bounce text-indigo-500" /> Receiving {file.fileName}
                    </span>
                    <span className="text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold">
                      {Math.round((file.receivedBytes / file.fileSize) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-indigo-200/50 dark:bg-indigo-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(2, (file.receivedBytes / file.fileSize) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 border-dashed rounded-[2rem] transition-colors duration-200 backdrop-blur-sm shadow-sm"
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-slate-100 to-white dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white dark:border-slate-700/50">
                <Users className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-lg transition-colors duration-200">The board is empty</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 transition-colors duration-200 max-w-xs mx-auto leading-relaxed">
                Anything you share will instantly appear here for everyone on your network.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    layout
                    key={item.id}
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
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Debug console */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-3xl mx-auto p-6 text-xs font-mono text-slate-500 overflow-x-auto">
          <h3 className="font-bold mb-2">Debug Console</h3>
          <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl max-h-64 overflow-y-auto transition-colors duration-200">
            ID: {myId || 'None'} | Room: {roomCode || 'None'}<br />
            {debugLogs?.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>
      )}

      <Toaster position="bottom-right" />
    </div>
  );
}
