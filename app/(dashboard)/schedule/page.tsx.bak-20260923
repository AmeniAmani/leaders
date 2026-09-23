"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Plus, X, BookOpen, User, Home, Layers, Trash2, Pencil, Printer, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const HOURS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];

interface ScheduleEntry {
    id: number;
    day: string;
    start: string;
    duration: number;
    subjectId: number;
    subject?: { name: string };
    classId: string;
    teacherId: string;
    roomId: string;
    as: string;
    group?: boolean;
    week?: string;
    color: string;
}

const COLORS = [
    "bg-indigo-100 border-indigo-200 text-indigo-700",
    "bg-pink-100 border-pink-200 text-pink-700",
    "bg-emerald-100 border-emerald-200 text-emerald-700",
    "bg-amber-100 border-amber-200 text-amber-700",
    "bg-sky-100 border-sky-200 text-sky-700",
    "bg-violet-100 border-violet-200 text-violet-700",
];

export default function SchedulePage() {
    const [currentWeek, setCurrentWeek] = useState("Semaine actuelle");
    const [viewMode, setViewMode] = useState<"class" | "teacher" | "room">("class");
    const [selectedId, setSelectedId] = useState("");
    const [selectedAS, setSelectedAS] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        return now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
    });
    const [anneeScolaires, setAnneeScolaires] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [entries, setEntries] = useState<ScheduleEntry[]>([]);

    // Data states
    const [classes, setClasses] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        subjectId: "",
        day: "Lundi",
        start: "08:00",
        duration: "1",
        roomId: "",
        teacherId: "",
        classId: "",
        group: false,
        week: "all"
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [scheduleRes, classesRes, teachersRes, roomsRes, subjectsRes] = await Promise.all([
                fetch('/api/schedule'),
                fetch('/api/classes'),
                fetch('/api/teachers'),
                fetch('/api/rooms'),
                fetch('/api/subjects')
            ]);

            if (scheduleRes.ok) {
                const data = await scheduleRes.json();
                // Map API data to ScheduleEntry format
                setEntries(data.map((e: any) => ({
                    ...e,
                    classId: String(e.classId),
                    teacherId: String(e.teacherId),
                    roomId: String(e.roomId),
                    subjectId: e.subjectId,
                    color: COLORS[e.id % COLORS.length]
                })));

                // Update anneeScolaires from data
                const yearsInDB = Array.from(new Set(data.map((e: any) => e.as))).filter(Boolean) as string[];
                const currentYear = (() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    return now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
                })();

                const allYears = Array.from(new Set([currentYear, ...yearsInDB])).sort((a, b) => b.localeCompare(a));
                setAnneeScolaires(allYears);
            }
            if (classesRes.ok) setClasses(await classesRes.json());
            if (teachersRes.ok) setTeachers(await teachersRes.json());
            if (roomsRes.ok) setRooms(await roomsRes.json());
            if (subjectsRes.ok) setSubjects(await subjectsRes.json());
        } catch (error) {
            console.error("Failed to fetch schedule data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getCookie = (name: string) => {
        if (typeof document === "undefined") return null;

        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] ?? null;
    };

    const [role, setRole] = useState('');
    const [userId, setUserId] = useState('');

    useEffect(() => {
        setRole(getCookie("user-role") ?? "N/A");
        setUserId(getCookie("user-id") ?? "");
    }, []);

    useEffect(() => {
        if (role === 'prof' && userId) {
            setViewMode("teacher");
            setSelectedId(userId);

            const now = new Date();
            const year = now.getFullYear();
            const currentYear = now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
            setSelectedAS(currentYear);
        }
    }, [role, userId]);

    let isReadOnly = role !== 'admin';

    const filteredEntries = useMemo(() => {
        if (!selectedId) return [];
        return entries.filter(entry => {
            const matchesYear = entry.as === selectedAS;
            if (!matchesYear) return false;

            if (viewMode === "class") return String(entry.classId) === selectedId;
            if (viewMode === "teacher") return String(entry.teacherId) === selectedId;
            return String(entry.roomId) === selectedId;
        });
    }, [entries, viewMode, selectedId, selectedAS]);

    const handleAnneeScolaireChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedAS(e.target.value);
    };

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        const entryData = {
            subjectId: formData.subjectId ? parseInt(formData.subjectId) : null,
            day: formData.day,
            start: formData.start,
            duration: parseFloat(formData.duration),
            roomId: viewMode === "room" ? selectedId : formData.roomId,
            teacherId: viewMode === "teacher" ? selectedId : formData.teacherId,
            classId: viewMode === "class" ? selectedId : formData.classId,
            as: selectedAS,
            group: formData.group,
            week: formData.week
        };

        try {
            if (editingId) {
                const res = await fetch(`/api/schedule/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entryData)
                });
                if (res.ok) {
                    const updated = await res.json();
                    setEntries(entries.map(e => e.id === editingId ? { ...updated, classId: String(updated.classId), teacherId: String(updated.teacherId), roomId: String(updated.roomId), color: e.color } : e));
                }
            } else {
                const res = await fetch('/api/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entryData)
                });
                if (res.ok) {
                    const newEntry = await res.json();
                    setEntries([...entries, { ...newEntry, classId: String(newEntry.classId), teacherId: String(newEntry.teacherId), roomId: String(newEntry.roomId), color: COLORS[entries.length % COLORS.length] }]);
                }
            }
        } catch (err) {
            console.error("Failed to save entry", err);
        }

        setIsAdding(false);
        setEditingId(null);
        setFormData({
            subjectId: "",
            day: "Lundi",
            start: "08:00",
            duration: "1",
            roomId: "",
            teacherId: "",
            classId: "",
            group: false,
            week: "all"
        });
    };

    const handleEditEntry = (entry: ScheduleEntry) => {
        setEditingId(entry.id);
        setFormData({
            subjectId: String(entry.subjectId),
            day: entry.day,
            start: entry.start,
            duration: entry.duration.toString(),
            roomId: entry.roomId,
            teacherId: entry.teacherId,
            classId: entry.classId,
            group: entry.group || false,
            week: entry.week || "all"
        });
        setIsAdding(true);
    };

    const handleDeleteEntry = async (id: number) => {
        if (window.confirm("Voulez-vous vraiment supprimer ce cours ?")) {
            try {
                await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
                setEntries(entries.filter(e => e.id !== id));
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 h-[calc(100vh-8rem)] flex flex-col relative">
            {/* Print Header (Only visible on print) */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Emploi du temps</h1>
                        <p className="text-lg font-bold text-slate-700 mt-1">
                            {viewMode === "class" ? "Classe : " : viewMode === "teacher" ? "Enseignant : " : "Salle : "}
                            {selectedId ? (
                                viewMode === "class" ? (
                                    (() => {
                                        const c = classes.find(c => String(c.id) === selectedId);
                                        if (!c) return "Aucun sélectionné";

                                        const levels: Record<string, string> = {
                                            "1": "السابعة أساسي",
                                            "2": "الثامنة أساسي",
                                            "3": "التاسعة أساسي",
                                        };

                                        return `${levels[c.level]} ${c.name}`;
                                    })()
                                ) : viewMode === "teacher" ? (
                                    teachers.find(t => String(t.id) === selectedId)?.name ?? "Aucun sélectionné"
                                ) : (
                                    rooms.find(r => String(r.id) === selectedId)?.name ?? "Aucun sélectionné"
                                )
                            ) : (
                                "Aucun sélectionné"
                            )}

                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold">{currentWeek}</p>
                        <p className="text-xs text-slate-500">Généré le {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                :root {
                    --print-hour-height: 6rem;
                }
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 0.5cm;
                    }
                    :root {
                        --print-hour-height: 6.5rem;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        background: white !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    
                    /* NEW: Fix for row height in print */
                    .print-row {
                        height: var(--print-hour-height) !important;
                        min-height: var(--print-hour-height) !important;
                        page-break-inside: avoid;
                    }
                    .print-grid-container {
                        min-width: 100% !important;
                        width: 100% !important;
                    }

                    /* Scale down fonts for print */
                    .text-3xl { font-size: 1.5rem !important; }
                    .text-2xl { font-size: 1.25rem !important; }
                    .text-sm { font-size: 0.7rem !important; }
                    .text-xs { font-size: 0.6rem !important; }
                    .p-4 { padding: 0.5rem !important; }
                    .p-3 { padding: 0.15rem 0.4rem !important; }
                    .mb-8 { margin-bottom: 0.75rem !important; }
                    .gap-1 { gap: 0.05rem !important; }
                    .gap-1.5 { gap: 0.15rem !important; }
                    
                    /* Specific scaling for block content */
                    .group\/item span { font-size: 9px !important; line-height: 1 !important; }
                    .group\/item .font-bold { font-size: 10px !important; }
                    .group\/item .text-\[13px\] { font-size: 11px !important; }
                    .group\/item .text-\[12px\] { font-size: 10px !important; }
                    .group\/item .text-\[10px\] { font-size: 9px !important; }
                    .group\/item svg { width: 10px !important; height: 10px !important; }
                    
                    /* Remove transitions and transforms for better printing */
                    * {
                        transition: none !important;
                        transform: none !important;
                    }
                    .custom-scrollbar {
                        overflow: visible !important;
                    }
                    /* Ensure containers take full width and don't scroll */
                    .flex-1 {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    div[class*="h-[calc(100vh"] {
                        height: auto !important;
                    }
                    main {
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                        padding-top: 0 !important;
                    }
                }
            `}</style>

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 shrink-0 no-print">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-indigo-600" />
                        Emploi du temps
                    </h1>
                    <p className="text-slate-500 mt-1">Gérer les plannings par classe ou enseignant.</p>
                </div>

                {/** Annee Scolaire */}
                {role !== 'prof' && (
                    <div className="flex flex-wrap items-center gap-6">
                        <label className="text-l mx-6 font-medium text-slate-700">Année Scolaire</label>
                        <select
                            value={selectedAS}
                            name="as"
                            onChange={handleAnneeScolaireChange}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-700 min-w-[200px]"
                        >

                            {
                                anneeScolaires.map((as, index) => <option key={index} value={as}>{as}</option>)
                            }
                        </select>
                    </div>
                )}
            </div><br />
            {/** Select View Mode et choix classe/enseignant/salle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0 no-print">
                <div className="flex flex-wrap items-center gap-4">
                    {/* View Switcher */}
                    {role !== 'prof' && (
                        <div className="bg-slate-100 p-1 rounded-xl flex items-center">
                            <button
                                onClick={() => { setViewMode("class"); setSelectedId(""); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "class" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                <Home className="w-4 h-4 inline-block mr-2" />
                                Classe
                            </button>
                            <button
                                onClick={() => { setViewMode("teacher"); setSelectedId(""); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "teacher" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                <User className="w-4 h-4 inline-block mr-2" />
                                Enseignant
                            </button>
                            <button
                                onClick={() => { setViewMode("room"); setSelectedId(""); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "room" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                <MapPin className="w-4 h-4 inline-block mr-2" />
                                Salle
                            </button>
                        </div>
                    )}

                    {/* Select Classe, Enseignant, Salle : selon view mode */}
                    {role !== 'prof' ? (
                        <select
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-700 min-w-[200px]"
                        >
                            <option value="">Sélectionner {viewMode === "class" ? "une classe" : viewMode === "teacher" ? "un enseignant" : "une salle"}...</option>
                            {viewMode === "class" ? (
                                classes.map(c => <option key={c.id} value={c.id}>{(c.level === "1") ? `السابعة أساسي ${c.name}` : (c.level === "2") ? `الثامنة أساسي ${c.name}` : (c.level === "3") ? `التاسعة أساسي ${c.name}` : ""}</option>)
                            ) : viewMode === "teacher" ? (
                                teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                            ) : (
                                rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                            )}
                        </select>
                    ) : (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-600">
                            {teachers.find(t => String(t.id) === selectedId)?.name || "Mon Emploi du Temps"}
                        </div>
                    )}
                    {/** Button Ajouter un cours apres choix classe/enseignant/salle */}
                    {!isReadOnly && <button
                        onClick={() => {
                            setEditingId(null);
                            setIsAdding(true);
                            if (viewMode === "teacher") {
                                const teacher = teachers.find(t => String(t.id) === selectedId);
                                setFormData(prev => ({ ...prev, subjectId: String(teacher?.subjectId || ""), teacherId: selectedId, classId: "", roomId: "" }));
                            } else if (viewMode === "class") {
                                setFormData(prev => ({ ...prev, roomId: "", classId: selectedId, teacherId: "", subjectId: "" }));
                            } else {
                                setFormData(prev => ({ ...prev, roomId: selectedId, classId: "", teacherId: "", subjectId: "" }));
                            }
                        }}
                        disabled={!selectedId}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Ajouter un cours
                    </button>}
                    {/** Boutton Imprimer */}
                    <button
                        onClick={handlePrint}
                        disabled={!selectedId}
                        className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-slate-500/20 flex items-center gap-2 transition-all active:scale-95 no-print"
                    >
                        <Printer className="w-5 h-5" />
                        Imprimer
                    </button>
                </div>
            </div>

            {/* Timetable Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col relative">
                {/* Days Header */}
                <div className="grid grid-cols-[120px_1fr] border-b border-slate-200 bg-slate-50/50">
                    <div className="p-4 border-r border-slate-300 flex items-center justify-center text-slate-400">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div className="grid grid-cols-[repeat(20,minmax(0,1fr))]">
                        {HOURS.map((hour, idx) => (
                            <div
                                key={hour}
                                className={`h-8 relative border-l ${hour.endsWith(":00") ? "border-slate-300" : "border-slate-100"} first:border-l-0`}
                            >
                                {!hour.endsWith(":30") && (
                                    <span className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap left-1">
                                        {hour}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Grid Area */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <div className="min-w-[1200px] print-grid-container">
                        {DAYS.map((day, dayIndex) => (
                            <div key={day} className="grid grid-cols-[120px_1fr] border-b border-slate-200 relative group/day print-row">
                                {/* Day Column */}
                                <div className="border-r border-slate-300 bg-slate-50/30 flex items-center justify-center p-4 min-h-[120px] print:min-h-0 print:h-full">
                                    <span className="text-sm font-bold text-slate-600 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">{day}</span>
                                </div>

                                {/* Hours Row for this Day */}
                                <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] relative">
                                    {HOURS.map((hour, hi) => (
                                        <div key={hi} className={`border-l h-full ${hour.endsWith(":00") ? "border-slate-300/60" : "border-slate-100/50"} first:border-l-0`} />
                                    ))}

                                    {/* Events for this day */}
                                    {(() => {
                                        const dayEntries = filteredEntries.filter(item => item.day === day)
                                            .sort((a, b) => a.start.localeCompare(b.start));

                                        const assignedLanes: { [key: number]: 'top' | 'bottom' | 'full' } = {};

                                        // Pass 1: Determine who needs a lane vs full height
                                        dayEntries.forEach(entry => {
                                            const s = parseInt(entry.start.split(":")[0]) + parseInt(entry.start.split(":")[1] || "0") / 60;
                                            const e = s + entry.duration;
                                            const hasOverlap = dayEntries.some(o => {
                                                if (o.id === entry.id) return false;
                                                const os = parseInt(o.start.split(":")[0]) + parseInt(o.start.split(":")[1] || "0") / 60;
                                                const oe = os + o.duration;
                                                return (s < oe && e > os);
                                            });
                                            if (!hasOverlap && entry.week === "all" && !entry.group) {
                                                assignedLanes[entry.id] = 'full';
                                            }
                                        });

                                        // Pass 2: Assign specific lanes
                                        dayEntries.forEach(entry => {
                                            if (assignedLanes[entry.id] === 'full') return;

                                            if (entry.week === 'A') {
                                                assignedLanes[entry.id] = 'top';
                                            } else if (entry.week === 'B') {
                                                assignedLanes[entry.id] = 'bottom';
                                            } else {
                                                const s = parseInt(entry.start.split(":")[0]) + parseInt(entry.start.split(":")[1] || "0") / 60;
                                                const e = s + entry.duration;
                                                const overlaps = dayEntries.filter(o => {
                                                    if (o.id === entry.id) return false;
                                                    const os = parseInt(o.start.split(":")[0]) + parseInt(o.start.split(":")[1] || "0") / 60;
                                                    const oe = os + o.duration;
                                                    return (s < oe && e > os);
                                                });

                                                const topOccupied = overlaps.some(o => assignedLanes[o.id] === 'top' || (assignedLanes[o.id] === 'full' && (parseInt(o.start.split(":")[0]) + parseInt(o.start.split(":")[1] || "0") / 60) <= s));
                                                assignedLanes[entry.id] = topOccupied ? 'bottom' : 'top';
                                            }
                                        });

                                        return dayEntries.map(item => {
                                            const startHour = parseInt(item.start.split(":")[0]);
                                            const startMin = parseInt(item.start.split(":")[1] || "0");
                                            const offset = (startHour - 8) + (startMin / 60);
                                            const colStart = Math.round(offset * 2) + 1;
                                            const colSpan = Math.round(item.duration * 2);
                                            const lane = assignedLanes[item.id] || 'full';

                                            const room = rooms.find(r => String(r.id) === item.roomId);
                                            const teacher = teachers.find(t => String(t.id) === item.teacherId);
                                            const studentClass = classes.find(c => String(c.id) === item.classId);

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`absolute z-10 flex flex-col group/slot pointer-events-none px-0.5`}
                                                    style={{
                                                        left: `${(offset / 10) * 100}%`,
                                                        width: `${(item.duration / 10) * 100}%`,
                                                        top: lane === 'bottom' ? '50%' : '0',
                                                        height: lane === 'full' ? '100%' : '50%'
                                                    }}
                                                >
                                                    <div className={`w-full h-full rounded-xl border border-slate-200 pointer-events-auto shadow-sm relative overflow-hidden flex flex-col ${item.color} ${lane === 'top' ? 'border-b border-black/10' : ''}`}>
                                                        {/** Boutton Modifier et Supprimer Cours */}
                                                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/slot:opacity-100 transition-all z-20 no-print">
                                                            <button onClick={(e) => { e.stopPropagation(); handleEditEntry(item); }} className="p-1 rounded-lg bg-white/40 hover:bg-white/60 text-current transition-all"><Pencil className="w-3 h-3" /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteEntry(item.id); }} className="p-1 rounded-lg bg-white/40 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-3 h-3" /></button>
                                                        </div>
                                                        {/** Informations Cours */}
                                                        <div className="p-2 overflow-hidden leading-tight flex-1 flex flex-col justify-center">
                                                            {/** A/B/GR + Matiere */}
                                                            <span className="text-[10px] font-black uppercase opacity-80 block truncate">
                                                                {item.week === "A" ? "[A] " : item.week === "B" ? "[B] " : item.group ? "[GR] " : ""}
                                                                {subjects.find(s => s.id === item.subjectId)?.name || item.subject?.name}
                                                            </span>
                                                            {/** Enseignant + Salle | Classe */}
                                                            <div className="flex flex-col">
                                                                {/** Enseignant */}
                                                                <div className={viewMode === 'room' || viewMode === 'class' ? 'flex items-center gap-1 no-print' : 'flex items-center gap-1'}>
                                                                    <User className="w-2.5 h-2.5 opacity-60" />
                                                                    <span className="font-bold text-[11px] truncate">{teacher?.name}</span>
                                                                </div>
                                                                {/** Salle | Classe */}
                                                                <div className={`flex items-center gap-1`}>
                                                                    <Home className="w-2.5 h-2.5 opacity-60" />
                                                                    <span className="font-medium text-[10px] truncate">
                                                                        <span className={`${viewMode === "room" ? "no-print" : ""}`}>{room?.name}</span>
                                                                        <span className={viewMode === "room" || viewMode === "class" ? "no-print" : ""}>|</span>
                                                                        <span className={`${viewMode === "class" ? "no-print" : ""}`}>{(studentClass?.level === "1") ? `${studentClass?.name}ق7أساسي` : (studentClass?.level === "2") ? `${studentClass?.name}ق8أساسي` : (studentClass?.level === "3") ? `${studentClass?.name}ق9أساسي` : ""}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/** Si Aucun cours planifié */}
                {filteredEntries.length === 0 && selectedId && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 flex-col gap-4 z-0">
                        <CalendarIcon className="w-16 h-16 text-slate-300" />
                        <p className="font-medium text-slate-400">Aucun cours planifié</p>
                    </div>
                )}
                {/** Si aucune vue selectionnée */}
                {!selectedId && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-[2px] z-20">
                        <div className="text-center p-8 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm">
                            <Layers className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Sélectionnez une vue</h3>
                            <p className="text-slate-500 text-sm">Choisissez une classe, un enseignant ou une salle pour gérer son emploi du temps.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Entry Modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-white"
                        >
                            {/** Header Modal */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                        {editingId ? "Modifier le cours" : "Nouveau cours"}
                                    </h2>
                                    <p className="text-sm text-slate-500 font-medium">Planifier un cours dans l'emploi du temps</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsAdding(false);
                                        setEditingId(null);
                                    }}
                                    className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/** Form Ajout Cours */}
                            <form onSubmit={handleAddEntry} className="p-8 space-y-6">
                                {/** Matiere : ligne Séparé */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Matière</label>
                                    {viewMode === "teacher" ? (
                                        <input
                                            required
                                            readOnly
                                            type="text"
                                            value={subjects.find(s => String(s.id) === formData.subjectId)?.name || ""}
                                            className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 cursor-not-allowed text-sm font-medium"
                                        />
                                    ) : (
                                        <select
                                            required
                                            value={formData.subjectId}
                                            onChange={(e) => setFormData({ ...formData, subjectId: e.target.value, teacherId: "" })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            <option value="">Sélectionner une matière...</option>
                                            {subjects.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {/** Jour / heure debut : meme ligne*/}
                                <div className="grid grid-cols-2 gap-4">
                                    {/** Jour */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Jour</label>
                                        <select
                                            value={formData.day}
                                            onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    {/** heure de début */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Heure de début</label>
                                        <select
                                            value={formData.start}
                                            onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {/** Duree / Salle : meme ligne */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/** Durée Debut */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Durée (heures)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0.5"
                                            max="4"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                    {/** Salle */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Salle</label>
                                        {viewMode === "room" ? (
                                            <input
                                                readOnly
                                                type="text"
                                                value={rooms.find(r => String(r.id) === formData.roomId)?.name || ""}
                                                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 cursor-not-allowed text-sm font-medium"
                                            />
                                        ) : (
                                            <select
                                                required
                                                value={formData.roomId}
                                                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                            >
                                                <option value="">Sélectionner une salle...</option>
                                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                                {/* View Room */}
                                {viewMode === "room" ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-700">Enseignant</label>
                                            <select
                                                required
                                                value={formData.teacherId}
                                                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                            >
                                                <option value="">Choisir...</option>
                                                {teachers.filter(t => !formData.subjectId || String(t.subjectId) === formData.subjectId).map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-700">Classe</label>
                                            <select
                                                required
                                                value={formData.classId}
                                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                            >
                                                <option value="">Choisir...</option>
                                                {classes.map(c => <option key={c.id} value={c.id}>
                                                    {(c.level === "1") ? `السابعة أساسي ${c.name}` : (c.level === "2") ? `الثامنة أساسي ${c.name}` : (c.level === "3") ? `التاسعة أساسي ${c.name}` : ""}
                                                </option>)}
                                            </select>
                                        </div>
                                    </div>
                                ) : /* View Class*/viewMode === "class" ? (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Enseignant</label>
                                        <select
                                            required
                                            value={formData.teacherId}
                                            onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            <option value="">Sélectionner un enseignant...</option>
                                            {teachers.filter(t => !formData.subjectId || String(t.subjectId) === formData.subjectId).map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : /* View Teacher*/(
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Classe</label>
                                        <select
                                            required
                                            value={formData.classId}
                                            onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            <option value="">Sélectionner une classe...</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>
                                                {(c.level === "1") ? `السابعة أساسي ${c.name}` : (c.level === "2") ? `الثامنة أساسي ${c.name}` : (c.level === "3") ? `التاسعة أساسي ${c.name}` : ""}
                                            </option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/50">
                                        <input
                                            type="checkbox"
                                            id="group-checkbox"
                                            checked={formData.group}
                                            onChange={(e) => setFormData({ ...formData, group: e.target.checked })}
                                            className="w-5 h-5 text-indigo-600 border-slate-300 rounded-lg focus:ring-indigo-500 transition-all cursor-pointer"
                                        />
                                        <label htmlFor="group-checkbox" className="text-sm font-bold text-slate-700 cursor-pointer select-none">Par groupe</label>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Semaine</label>
                                        <select
                                            value={formData.week}
                                            onChange={(e) => setFormData({ ...formData, week: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            <option value="all">Chaque semaine</option>
                                            <option value="A">Semaine A</option>
                                            <option value="B">Semaine B</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAdding(false);
                                            setEditingId(null);
                                        }}
                                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
                                    >
                                        {editingId ? "Mettre à jour" : "Enregistrer"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
