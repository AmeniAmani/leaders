"use client"

import { isoler } from "@/lib/bidi";
import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Filter,
    GraduationCap,
    BookOpen,
    Calendar,
    Save,
    Loader2,
    AlertCircle,
    CheckCircle2,
    User,
    ClipboardList,
    ChevronDown,
    XCircle,
    RotateCcw
} from 'lucide-react';
import { filtreRecherche } from '@/lib/recherche';
import { motion, AnimatePresence } from 'framer-motion';

interface StudentData {
    id: number;
    name: string;
    noteepre: number | null;
    isAbsent: boolean;
    noteId: number | null;
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
    examTypes: string[];
    academicYears: string[];
}

const SaisieNotesPage = () => {
    // Selection state
    const [selectedAS, setSelectedAS] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [selectedExamType, setSelectedExamType] = useState<string>('');

    // Data state
    const [filters, setFilters] = useState<Filters>({
        classes: [],
        subjects: [],
        periods: [],
        examTypes: [],
        academicYears: []
    });
    const [students, setStudents] = useState<StudentData[]>([]);
    const [initialStudents, setInitialStudents] = useState<StudentData[]>([]);

    // UI state
    const [loadingFilters, setLoadingFilters] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
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

    const isSelectionComplete = selectedAS && selectedClass && selectedSubject && selectedPeriod && selectedExamType;

    // Fetch students when selection is complete
    useEffect(() => {
        if (!isSelectionComplete) {
            setStudents([]);
            setInitialStudents([]);
            return;
        }

        const fetchStudents = async () => {
            setLoadingStudents(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    as: selectedAS,
                    classId: selectedClass,
                    subjectId: selectedSubject,
                    libperiodexam: selectedPeriod,
                    libTypeEpr: selectedExamType
                });
                const res = await fetch(`/api/notesDevoirs/students?${params.toString()}`);
                if (!res.ok) throw new Error('Failed to load students');
                const data = await res.json();
                setStudents(data);
                setInitialStudents(JSON.parse(JSON.stringify(data)));
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingStudents(false);
            }
        };
        fetchStudents();
    }, [selectedAS, selectedClass, selectedSubject, selectedPeriod, selectedExamType]);

    // Handle note change
    const handleNoteChange = (studentId: number, value: string) => {
        const note = value === '' ? null : parseFloat(value);
        if (note !== null && (isNaN(note) || note < 0 || note > 20)) return;

        setStudents(prev => prev.map(s =>
            s.id === studentId ? { ...s, noteepre: note, isAbsent: note !== null ? false : s.isAbsent } : s
        ));
    };

    // Handle absence toggle
    const handleAbsentToggle = (studentId: number) => {
        setStudents(prev => prev.map(s =>
            s.id === studentId ? {
                ...s,
                isAbsent: !s.isAbsent,
                noteepre: !s.isAbsent ? null : s.noteepre
            } : s
        ));
    };

    // Save notes
    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch('/api/notesDevoirs/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    as: selectedAS,
                    classId: selectedClass,
                    subjectId: selectedSubject,
                    libperiodexam: selectedPeriod,
                    libTypeEpr: selectedExamType,
                    notes: students.map(s => ({
                        studentId: s.id,
                        noteepre: s.noteepre,
                        isAbsent: s.isAbsent
                    }))
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save notes');
            }

            setSuccess('Notes enregistrées avec succès !');
            setInitialStudents(JSON.parse(JSON.stringify(students)));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = useMemo(() => {
        const correspond = filtreRecherche(searchTerm);
        return students.filter(s => correspond([s.name]));
    }, [students, searchTerm]);

    const hasChanges = JSON.stringify(students) !== JSON.stringify(initialStudents);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ClipboardList className="w-10 h-10 text-indigo-600" />
                        Saisie des Notes
                    </h1>
                    <p className="text-slate-500 font-medium italic">Enregistrez les notes de vos élèves en toute simplicité.</p>
                </div>

                <AnimatePresence>
                    {hasChanges && (
                        <motion.button
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Enregistrer les modifications
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/40 p-6 md:p-8 space-y-8">
                <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2">
                    <Filter className="w-5 h-5" />
                    Critères de sélection
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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
                                    const name = (cls.level === "1") ? "السابعة أساسي " + cls.name : (cls.level === "2") ? "الثامنة أساسي " + cls.name : (cls.level === "3") ? "التاسعة أساسي " + cls.name : ""
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

                    {/* Exam Type */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-indigo-500" />
                            Type Devoir
                        </label>
                        <div className="relative group">
                            <select
                                value={selectedExamType}
                                onChange={(e) => setSelectedExamType(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none font-bold text-slate-700"
                            >
                                <option value="">Choisir Type...</option>
                                {filters.examTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
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
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-600 font-bold shadow-sm"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        {success}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Section */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
                {loadingStudents ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <Loader2 className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <p className="text-slate-400 font-bold animate-pulse text-lg">Chargement des élèves...</p>
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
                            <p className="text-slate-500 font-medium max-w-sm">Choisissez une année, une classe, une matière, une période et un type de devoir pour commencer la saisie.</p>
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
                                        <th className="px-8 py-5 text-left">Élève</th>
                                        <th className="px-8 py-5 text-center w-[200px]">Note (0 - 20)</th>
                                        <th className="px-8 py-5 text-center w-[150px]">Status</th>
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
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                                                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-lg">{student.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex justify-center">
                                                    <input
                                                        type="number"
                                                        step="0.25"
                                                        min="0"
                                                        max="20"
                                                        value={student.noteepre ?? ''}
                                                        onChange={(e) => handleNoteChange(student.id, e.target.value)}
                                                        disabled={student.isAbsent}
                                                        className={`
                                                            w-24 text-center px-4 py-3 rounded-xl border-2 font-black text-lg transition-all
                                                            ${student.isAbsent
                                                                ? 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed'
                                                                : 'bg-white border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-800'}
                                                            ${student.noteepre !== null && student.noteepre < 10 && !student.isAbsent ? 'text-rose-600' : ''}
                                                        `}
                                                        placeholder="--"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => handleAbsentToggle(student.id)}
                                                        className={`
                                                            px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all flex items-center gap-2
                                                            ${student.isAbsent
                                                                ? 'bg-rose-50 border-rose-100 text-rose-600 shadow-sm'
                                                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}
                                                        `}
                                                    >
                                                        {student.isAbsent ? <XCircle className="w-4 h-4" /> : <RotateCcw className="w-4 h-4 opacity-0 group-hover:opacity-100" />}
                                                        {student.isAbsent ? 'Absent' : 'Présent'}
                                                    </button>
                                                </div>
                                            </td>
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

export default SaisieNotesPage;
