"use client";

import { BookOpen, Plus, MoreVertical, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Subject {
    id: number;
    name: string;
    codematiere: string;
    hoursLevel1: number | null;
    hoursLevel2: number | null;
    hoursLevel3: number | null;
    teachers: any[];
}

const COLORS = [
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-pink-500",
    "bg-sky-500",
    "bg-amber-500",
    "bg-slate-800"
];

export default function SubjectsPage() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const res = await fetch('/api/subjects');
                if (!res.ok) throw new Error('Failed to fetch subjects');
                const data = await res.json();
                setSubjects(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Error fetching subjects:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSubjects();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Chargement des matières...</div>;
    }

    // Matières dont aucun volume horaire n'est renseigné
    const sansHoraire = subjects.filter(
        s => !s.hoursLevel1 && !s.hoursLevel2 && !s.hoursLevel3
    ).length;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Matières</h1>
                    <p className="text-slate-500 mt-1">Programme scolaire et volumes horaires.</p>
                </div>
                <Link href="/subjects/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
                    <Plus className="w-5 h-5" />
                    Nouvelle Matière
                </Link>
            </div>

            {/* Matières à compléter */}
            {sansHoraire > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-amber-800 text-sm">
                            {sansHoraire} matière(s) sans volume horaire
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            Ouvrez chaque matière signalée en orange pour indiquer ses heures par semaine.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {subjects.map((subject, index) => {
                    const color = COLORS[index % COLORS.length];
                    const teacherCount = subject.teachers ? subject.teachers.length : 0;
                    const niveaux = [
                        { court: "7ème", h: subject.hoursLevel1 },
                        { court: "8ème", h: subject.hoursLevel2 },
                        { court: "9ème", h: subject.hoursLevel3 },
                    ];
                    const aDesHoraires = niveaux.some(n => n.h);

                    return (
                        <div
                            key={subject.id}
                            className={`group bg-white rounded-2xl border shadow-sm p-6 hover:shadow-lg transition-all ${
                                aDesHoraires ? "border-slate-100 hover:border-indigo-100" : "border-amber-200"
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white shadow-md`}>
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>

                            <Link href={`/subjects/${subject.id}`} className="block">
                                <h3 className="text-lg font-bold text-slate-900 mt-4 hover:text-indigo-600 transition-colors">{subject.name}</h3>
                            </Link>

                            {/* Volume horaire par niveau */}
                            <div className="mt-3 pb-3 border-b border-slate-50">
                                {aDesHoraires ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        {niveaux.map(n => (
                                            <span
                                                key={n.court}
                                                className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                                                    n.h
                                                        ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                                        : "bg-slate-50 text-slate-300 border-slate-100"
                                                }`}
                                                title={n.h ? `${n.court} : ${n.h} h par semaine` : `Non enseignée en ${n.court}`}
                                            >
                                                {n.court} {n.h ? `${n.h}h` : "—"}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <Link
                                        href={`/subjects/${subject.id}`}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:underline"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Volume horaire à renseigner
                                    </Link>
                                )}
                            </div>

                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500 font-medium">Enseignants</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-700">{teacherCount}</span>
                                    <div className="flex -space-x-2">
                                        {[...Array(Math.min(teacherCount, 3))].map((_, i) => (
                                            <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white" />
                                        ))}
                                        {teacherCount > 3 && (
                                            <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-slate-600">
                                                +{teacherCount - 3}
                                            </div>
                                        )}
                                    </div>
                                    {teacherCount === 0 && <span className="text-xs text-slate-400 font-medium">Aucun enseignant</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {subjects.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 border-dashed">
                    <p className="text-slate-500">Aucune matière trouvée.</p>
                </div>
            )}
        </div>
    );
}