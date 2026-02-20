'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { Download } from 'lucide-react';

export function IncomingFilesProgress() {
    const { incomingFiles } = useBoardStore();
    const incomingFilesArray = Object.values(incomingFiles);

    if (incomingFilesArray.length === 0) return null;

    return (
        <div className="space-y-3 mb-6">
            {incomingFilesArray.map(file => (
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
    );
}
