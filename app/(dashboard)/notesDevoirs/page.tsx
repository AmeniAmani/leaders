"use client"

import { isoler } from "@/lib/bidi";
import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Filter,
    GraduationCap,
    BookOpen,
    Calendar,
    Loader2,
    AlertCircle,
    User,
    ClipboardList,
    ChevronDown,
    FileText,
    TrendingUp
} from 'lucide-react';
import { filtreRecherche } from '@/lib/recherche';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface GradeData {
    note: number | null;
    isAbsent: boolean;
}

interface StudentData {
    id: number;
    name: string;
    grades: Record<string, GradeData>;
}

interface FilterOption {
    id: number | string;
    name: string;
    level?: string;
}

interface Filters {
    classes: FilterOption[];
    subjects: FilterOption[];
    periods: string[];
    academicYears: string[];
}

const VisualisationNotesPage = () => {
    // Selection state
    const [selectedAS, setSelectedAS] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');

    // Data state
    const [filters, setFilters] = useState<Filters>({
        classes: [],
        subjects: [],
        periods: [],
        academicYears: []
    });
    const [students, setStudents] = useState<StudentData[]>([]);
    const [examTypes, setExamTypes] = useState<string[]>(['DC1', 'DC2', 'TP', 'Orale', 'DS']);

    // UI state
    const [loadingFilters, setLoadingFilters] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch filters on mount
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const res = await fetch('/api/notesDevoirs/filters');
                if (!res.ok) throw new Error('Failed to load filters');
                const data = await res.json();
                setFilters(data);

                // Auto-select if only one option
                if (data.subjects.length === 1) {
                    setSelectedSubject(data.subjects[0].id.toString());
                }
                if (data.classes.length === 1) {
                    setSelectedClass(data.classes[0].id.toString());
                }

                // Default AS (current school year)
                const now = new Date();
                const year = now.getFullYear();
                const currentAS = now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
                if (data.academicYears.includes(currentAS)) {
                    setSelectedAS(currentAS);
                } else if (data.academicYears.length > 0) {
                    setSelectedAS(data.academicYears[0]);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingFilters(false);
            }
        };
        fetchFilters();
    }, []);

    const isSelectionComplete = selectedAS && selectedClass && selectedSubject && selectedPeriod;

    // Fetch notes when selection is complete
    useEffect(() => {
        if (!isSelectionComplete) {
            setStudents([]);
            return;
        }

        const fetchNotes = async () => {
            setLoadingData(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    as: selectedAS,
                    classId: selectedClass,
                    subjectId: selectedSubject,
                    libperiodexam: selectedPeriod
                });
                const res = await fetch(`/api/notesDevoirs?${params.toString()}`);
                if (!res.ok) throw new Error('Failed to load notes');
                const data = await res.json();
                setStudents(data.students);
                setExamTypes(data.examTypes);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingData(false);
            }
        };
        fetchNotes();
    }, [selectedAS, selectedClass, selectedSubject, selectedPeriod]);

    const filteredStudents = useMemo(() => {
        const correspond = filtreRecherche(searchTerm);
        return students.filter(s => correspond([s.name]));
    }, [students, searchTerm]);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-10 h-10 text-indigo-600" />
                        Visualisation des Notes
                    </h1>
                    <p className="text-slate-500 font-medium italic">Consultez les performances de vos élèves en un coup d'œil.</p>
                </div>

                <Link
                    href="/notesDevoirs/saisie"
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-indigo-600 border-2 border-indigo-100 px-6 py-3 rounded-2xl font-bold shadow-sm transition-all hover:shadow-md active:scale-95"
                >
                    <FileText className="w-5 h-5" />
                    <span>Saisie Notes</span>
                </Link>

            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/40 p-6 md:p-8 space-y-8">
                <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2">
                    <Filter className="w-5 h-5" />
                    Critères d'affichage
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Academic Year */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            Année Scolaire
                        </label>
                        <div className="relative group">
                            <select
                                value={selectedAS}
                                onChange={(e) => setSelectedAS(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none font-bold text-slate-700"
                                disabled={loadingFilters}
                            >
                                <option value="">Choisir AS...</option>
                                {filters.academicYears.map(as => (
                                    <option key={as} value={as}>{as}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none group-focus-within:text-indigo-500" />
                        </div>
                    </div>

                    {/* Class */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-indigo-500" />
                            Classe
                        </label>
                        <div className="relative group">
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none font-bold text-slate-700"
                            >
                                <option value="">Choisir Classe...</option>
                                {filters.classes.map((cls) => {
                                    const name = (cls.level === "1") ? "السابعة أساسي " + cls.name : (cls.level === "2") ? "الثامنة أساسي " + cls.name : (cls.level === "3") ? "التاسعة أساسي " + cls.name : cls.name;
                                    return (
                                        <option key={cls.id} value={cls.id}>
                                            {isoler(name)}
                                        </option>
                                    )
                                })}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none group-focus-within:text-indigo-500" />
                        </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                            Matière
                        </label>
                        <div className="relative group">
                            <select
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none font-bold text-slate-700"
                            >
                                <option value="">Choisir Matière...</option>
                                {filters.subjects.map(s => (
                                    <option key={s.id} value={s.id}>{isoler(s.name)}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none group-focus-within:text-indigo-500" />
                        </div>
                    </div>

                    {/* Period */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            Période
                        </label>
                        <div className="relative group">
                            <select
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none font-bold text-slate-700"
                            >
                                <option value="">Choisir Période...</option>
                                {filters.periods.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none group-focus-within:text-indigo-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Notifications */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 font-bold shadow-sm"
                    >
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Section */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
                {loadingData ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <Loader2 className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <p className="text-slate-400 font-bold animate-pulse text-lg">Chargement des résultats...</p>
                    </div>
                ) : !isSelectionComplete ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-8 text-center bg-white/40 backdrop-blur-sm rounded-[3rem] border border-white/60">
                        <div className="relative">
                            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center">
                                <Filter className="w-12 h-12 text-indigo-400 opacity-60" />
                            </div>
                            <div className="absolute -top-2 -right-2 bg-amber-400 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-amber-100">!</div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-2xl font-black text-slate-800 tracking-tight">Veuillez compléter la sélection</p>
                            <p className="text-slate-500 font-medium max-w-sm">Choisissez une année, une classe, une matière et une période pour visualiser les notes.</p>
                        </div>
                    </div>
                ) : students.length > 0 ? (
                    <>
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un élève..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium text-slate-700"
                                />
                            </div>
                            <div className="text-slate-400 font-bold text-sm">
                                {students.length} Élèves au total
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/30">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                    <tr className="text-slate-400 uppercase text-[11px] font-black tracking-widest border-b border-slate-100">
                                        <th className="px-8 py-5 text-left bg-white sticky left-0 z-20">Élève</th>
                                        {examTypes.map(type => (
                                            <th key={type} className="px-6 py-5 text-center">{type}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStudents.map((student, idx) => (
                                        <motion.tr
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            key={student.id}
                                            className="bg-white hover:bg-indigo-50/30 transition-colors group"
                                        >
                                            <td className="px-8 py-4 bg-white sticky left-0 group-hover:bg-indigo-50/30 transition-colors z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                                                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-lg">{student.name}</span>
                                                </div>
                                            </td>
                                            {examTypes.map(type => {
                                                const gradeInfo = student.grades[type];
                                                return (
                                                    <td key={type} className="px-6 py-4 text-center">
                                                        <div className="flex justify-center">
                                                            <span className={`
                                                                inline-flex items-center justify-center min-w-[65px] h-[32px] px-2 rounded-lg font-bold text-sm border
                                                                ${gradeInfo.isAbsent
                                                                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                                                                    : gradeInfo.note !== null
                                                                        ? gradeInfo.note >= 10
                                                                            ? 'bg-blue-50 text-indigo-600 border-indigo-200'
                                                                            : 'bg-amber-50 text-amber-600 border-amber-200'
                                                                        : 'bg-slate-50 text-slate-300 border-slate-100'}
                                                            `}>
                                                                {gradeInfo.isAbsent ? 'Absent' : gradeInfo.note !== null ? gradeInfo.note.toFixed(2) : '--.--'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6 bg-white/40 backdrop-blur-sm rounded-[3rem] border border-white/60">
                        <div className="bg-amber-50 p-8 rounded-full">
                            <User className="w-16 h-16 text-amber-400" />
                        </div>
                        <div className="space-y-1 text-center">
                            <p className="text-xl font-black text-slate-400">Aucun élève trouvé</p>
                            <p className="text-slate-400 font-medium text-sm">Il n'y a aucun élève inscrit dans cette classe.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisualisationNotesPage;
