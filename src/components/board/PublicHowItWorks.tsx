'use client';

import { motion } from 'framer-motion';
import { Wifi, Send, MonitorSmartphone, ShieldCheck, Clock, Zap } from 'lucide-react';

const steps = [
    {
        icon: Wifi,
        title: 'Connect to the same network',
        description: 'Open this page on any device connected to your Wi-Fi. Devices are auto-discovered.',
        accent: 'from-blue-500 to-cyan-400',
        accentBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    },
    {
        icon: Send,
        title: 'Share text or files',
        description: 'Type a message or drop files into the input bar. Everything is sent instantly.',
        accent: 'from-violet-500 to-purple-400',
        accentBg: 'bg-violet-500/10 dark:bg-violet-500/20',
    },
    {
        icon: MonitorSmartphone,
        title: 'Receive on any device',
        description: 'Shared items appear on every connected device in real-time. No accounts needed.',
        accent: 'from-emerald-500 to-teal-400',
        accentBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    },
];

const features = [
    { icon: ShieldCheck, label: 'Peer-to-peer', sublabel: 'No servers touch your data' },
    { icon: Clock, label: 'Auto-expire', sublabel: 'Items vanish after 15 min' },
    { icon: Zap, label: 'Instant', sublabel: 'Zero setup required' },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 24, filter: 'blur(4px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

export function PublicHowItWorks({ className }: { className?: string }) {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={`flex flex-col items-center justify-center px-4 max-w-2xl mx-auto select-none ${className || ''}`}
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide mb-5">
                    <Zap className="w-3 h-3" />
                    GETTING STARTED
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                    How It Works
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-3 max-w-md mx-auto leading-relaxed">
                    Share text and files between devices on your local network — privately, instantly, with zero setup.
                </p>
            </motion.div>

            {/* Steps */}
            <motion.div variants={containerVariants} className="w-full space-y-3 mb-6">
                {steps.map((step, i) => (
                    <motion.div key={step.title} variants={itemVariants} className="group relative">
                        <div className={`absolute -inset-0.5 bg-gradient-to-r ${step.accent} rounded-[1.6rem] blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none`} />
                        <div className="relative flex items-start gap-5 p-5 sm:p-6 rounded-[1.5rem] bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/60 dark:border-slate-800/60 shadow-[0_4px_24px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgb(0,0,0,0.15)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                            <div className="flex-shrink-0 relative">
                                <div className={`w-12 h-12 rounded-2xl ${step.accentBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                                    <step.icon className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                                </div>
                                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center shadow-sm">
                                    {i + 1}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                                <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight">{step.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{step.description}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Feature Pills */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-3">
                {features.map((f) => (
                    <div key={f.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-colors">
                        <f.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-none">{f.label}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{f.sublabel}</span>
                        </div>
                    </div>
                ))}
            </motion.div>
        </motion.div>
    );
}
