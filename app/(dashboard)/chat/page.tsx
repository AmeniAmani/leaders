"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect, useRef } from "react";
import { Search, Send, Trash2, Loader2, Users, Globe, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    id: number;
    studentId: number | null;
    sendTo: number | null;
    message: string;
    createdAt: string;
    student: {
        id: number;
        firstName: string;
        lastName: string;
        photo: string | null;
        chatBlocked: boolean;
    } | null;
}

interface Class {
    id: number;
    name: string;
    level: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string | number>('global');
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isGlobalBlocked, setIsGlobalBlocked] = useState(false);
    const [isClassBlocked, setIsClassBlocked] = useState(false);
    const [blockedStudents, setBlockedStudents] = useState<Set<number>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        fetchMessages();
        fetchSettings();
        const interval = setInterval(() => {
            fetchMessages();
            fetchSettings();
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedClassId]);

    const fetchClasses = async () => {
        try {
            const res = await fetch('/api/classes');
            if (res.ok) {
                const data = await res.json();
                setClasses(data);
            }
        } catch (error) {
            console.error("Failed to fetch classes", error);
        }
    };

    const fetchMessages = async () => {
        try {
            const res = await fetch(`/api/chat?classId=${selectedClassId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
                
                // Track blocked students from messages
                const blocked = new Set<number>();
                data.forEach((m: any) => {
                    if (m.student?.chatBlocked) {
                        blocked.add(m.studentId);
                    }
                });
                setBlockedStudents(blocked);
                
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Failed to fetch messages", error);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch(`/api/chat/settings?classId=${selectedClassId}`);
            if (res.ok) {
                const data = await res.json();
                setIsGlobalBlocked(data.global);
                setIsClassBlocked(data.classBlocked);
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sendTo: selectedClassId === 'global' ? null : Number(selectedClassId),
                    message: newMessage
                })
            });

            if (res.ok) {
                const sentMsg = await res.json();
                setMessages(prev => [...prev, sentMsg]);
                setNewMessage("");
                setTimeout(scrollToBottom, 100);
            }
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteMessage = async (id: number) => {
        if (!window.confirm("Supprimer ce message ?")) return;

        try {
            const res = await fetch(`/api/chat?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessages(prev => prev.filter(m => m.id !== id));
            }
        } catch (error) {
            console.error("Failed to delete message", error);
        }
    };

    const handleToggleBlock = async (type: 'global' | 'class' | 'student', targetId: number | null, blocked: boolean) => {
        try {
            const res = await fetch('/api/chat/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, targetId, blocked })
            });

            if (res.ok) {
                if (type === 'global') setIsGlobalBlocked(blocked);
                if (type === 'class') setIsClassBlocked(blocked);
                if (type === 'student' && targetId) {
                    setBlockedStudents(prev => {
                        const next = new Set(prev);
                        if (blocked) next.add(targetId);
                        else next.delete(targetId);
                        return next;
                    });
                    // Refresh messages to update all instances of this student
                    fetchMessages();
                }
            }
        } catch (error) {
            console.error(`Failed to toggle ${type} block`, error);
        }
    };

    const formatClassName = (cls: Class) => {
        return (cls.level === "1") ? "السابعة أساسي " + cls.name : 
               (cls.level === "2") ? "الثامنة أساسي " + cls.name : 
               (cls.level === "3") ? "التاسعة أساسي " + cls.name : cls.name;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Espace Chat</h1>
                    <p className="text-slate-500 mt-1">Communiquez avec les élèves et les classes.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value === 'global' ? 'global' : Number(e.target.value))}
                            className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer hover:border-indigo-500/50 transition-colors"
                        >
                            <option value="global">Général (Tout le monde)</option>
                            <optgroup label="Classes">
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{isoler(formatClassName(cls))}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    <button
                        onClick={() => handleToggleBlock('global', null, !isGlobalBlocked)}
                        className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                            isGlobalBlocked 
                            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Globe className="w-4 h-4" />
                        {isGlobalBlocked ? "Chat Global Bloqué" : "Bloquer Global"}
                    </button>

                    {selectedClassId !== 'global' && (
                        <button
                            onClick={() => handleToggleBlock('class', Number(selectedClassId), !isClassBlocked)}
                            className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                                isClassBlocked 
                                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            {isClassBlocked ? "Classe Bloquée" : "Bloquer Classe"}
                        </button>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                            <Globe className="w-12 h-12 opacity-10" />
                            <p>Aucun message dans cette conversation</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            const isAdmin = msg.studentId === null;
                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} group`}
                                >
                                    <div className={`flex flex-col max-w-[70%] ${isAdmin ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            {!isAdmin && (
                                                <span className="text-xs font-semibold text-slate-500">
                                                    {msg.student?.firstName} {msg.student?.lastName}
                                                </span>
                                            )}
                                            {isAdmin && <span className="text-xs font-semibold text-indigo-600">Admin</span>}
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            
                                            <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${
                                                isAdmin 
                                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                                : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                                            }`}>
                                                {msg.message}
                                            </div>

                                            {!isAdmin && (
                                                <div className="flex flex-col items-center gap-2">
                                                    <button
                                                        onClick={() => handleToggleBlock('student', msg.studentId, !blockedStudents.has(msg.studentId!))}
                                                        className={`opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all ${
                                                            blockedStudents.has(msg.studentId!)
                                                            ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                        }`}
                                                        title={blockedStudents.has(msg.studentId!) ? "Débloquer l'élève" : "Bloquer l'élève"}
                                                    >
                                                        <User className={`w-4 h-4 ${blockedStudents.has(msg.studentId!) ? 'fill-current' : ''}`} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-100">
                    <form onSubmit={handleSendMessage} className="flex gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={selectedClassId === 'global' ? "Envoyer un message à tout le monde..." : "Envoyer un message à la classe..."}
                            className="flex-1 px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 font-medium placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || isSending}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-all active:scale-90"
                        >
                            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
