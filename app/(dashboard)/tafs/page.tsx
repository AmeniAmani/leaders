"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Filter, Eye, Trash2, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface Taf {
    id: number;
    dateTaf: string;
    type: string;
    subjectId: number;
    subject: {
        id: number;
        name: string;
    } | null;
    classId: number;
    class: {
        id: number;
        name: string;
        level: string | null;
    } | null;
}

// Libellé arabe d'une classe (même logique que le reste de l'application)
const classLabel = (c?: { level: string | null; name: string } | null) => {
    if (!c) return "N/A";
    const prefix =
        c.level === "1" ? "السابعة أساسي " :
        c.level === "2" ? "الثامنة أساسي " :
        c.level === "3" ? "التاسعة أساسي " : "";
    return prefix + (c.name || "");
};

export default function TafsPage() {
    const [tafs, setTafs] = useState<Taf[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState("");
    const [classes, setClasses] = useState<any[]>([]);

    const getCookie = (name: string) => {
        if (typeof document === "undefined") return null;

        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] ?? null;
    };

    const [role, setRole] = useState('');

    useEffect(() => {
        setRole(getCookie("user-role") ?? "N/A");
    }, []);
    const isAdmin = role === 'admin';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const userRole = getCookie("user-role");
            const userId = getCookie("user-id");
            const isTeacher = userRole !== 'admin' && !!userId;

            const [tafsRes, classesRes] = await Promise.all([
                fetch(isTeacher ? `/api/tafs/teacher/${userId}` : '/api/tafs'),
                fetch(isTeacher ? `/api/classes/teacher/${userId}` : '/api/classes')
            ]);

            if (tafsRes.ok) {
                const tafsData = await tafsRes.json();
                setTafs(Array.isArray(tafsData) ? tafsData : []);
            }
            if (classesRes.ok) {
                const classesData = await classesRes.json();
                setClasses(Array.isArray(classesData) ? classesData : []);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce devoir ?")) {
            try {
                const res = await fetch(`/api/tafs/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error("Suppression refusée");
                setTafs(tafs.filter(t => t.id !== id));
            } catch (err) {
                console.error("Failed to delete", err);
                alert("Erreur lors de la suppression");
            }
        }
    };

    const filteredTafs = tafs.filter(taf => {
        const matchesSearch = `${taf.subject?.name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = selectedClass ? taf.classId === Number(selectedClass) : true;
        return matchesSearch && matchesClass;
    });

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Gestion des Devoirs / Travail à Faire</h1>
                    <p className="text-slate-500 mt-1">Gérez les devoirs et travaux à faire donnés aux classes.</p>
                </div>
                <Link href="/tafs/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
                    <Plus className="w-5 h-5" />
                    Nouveau TAF
                </Link>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Rechercher un devoir par matière..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="appearance-none pl-10 pr-8 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                            <option value="">{isAdmin ? "Toutes les classes" : "Mes classes"}</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>
                                    {classLabel(c)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Matière</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Classe</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Type</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Date</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredTafs.map((taf, index) => {
                                return (
                                    <motion.tr
                                        key={taf.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-slate-50/80 transition-colors group"
                                    >
                                        {/* Matiere */}
                                        <td className="p-4">
                                            {taf.subject ? (
                                                isAdmin ? (
                                                    <Link href={`/subjects?highlight=${taf.subjectId}`} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors">
                                                        <div className="p-1.5 bg-slate-100 rounded-full transition-colors">
                                                            <BookOpen className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className="text-sm font-medium">{taf.subject.name}</span>
                                                    </Link>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <div className="p-1.5 bg-slate-100 rounded-full">
                                                            <BookOpen className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className="text-sm font-medium">{taf.subject.name}</span>
                                                    </div>
                                                )
                                            ) : (
                                                <span className="text-slate-400 text-sm">Non assigné</span>
                                            )}
                                        </td>
                                        {/* Classe */}
                                        <td className="p-4">
                                            <span className="text-sm font-medium">{classLabel(taf.class)}</span>
                                        </td>
                                        {/* Type */}
                                        <td className="p-4">
                                            <span className="text-sm font-medium">{taf.type === "devoir" ? "Devoir" : "Travail à faire"}</span>
                                        </td>
                                        {/* Date */}
                                        <td className="p-4">
                                            <span className="text-sm font-medium">{taf.dateTaf ? new Date(taf.dateTaf).toLocaleDateString("fr-FR") : "Pas de date"}</span>
                                        </td>
                                        {/* Actions */}
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/tafs/${taf.id}`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all" title="Voir le détail">
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                                {isAdmin && <button
                                                    onClick={() => handleDelete(taf.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>}
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredTafs.length === 0 && (
                    <div className="p-12 text-center text-slate-400 bg-slate-50/50">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Aucun devoir trouvé.</p>
                    </div>
                )}
            </div>
        </div>
    );
}