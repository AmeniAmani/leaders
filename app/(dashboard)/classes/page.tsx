"use client";

import { useState, useEffect } from "react";
import { Plus, Users, ChevronRight, School, Loader2, AlertTriangle, MapPin } from "lucide-react";
import Link from "next/link";

export default function ClassesPage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Vrai quand l'utilisateur est un enseignant sans aucune classe assignée
    const [noClassAssigned, setNoClassAssigned] = useState(false);

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
    let isReadOnly = role !== 'admin';

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const userRole = getCookie("user-role");
            const userId = getCookie("user-id");
            const isTeacher = userRole !== 'admin' && !!userId;

            // Un enseignant ne voit que les classes qui lui sont assignées
            const url = isTeacher ? `/api/classes/teacher/${userId}` : '/api/classes';

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : [];
                setClasses(list);
                setNoClassAssigned(isTeacher && list.length === 0);
            }
        } catch (error) {
            console.error("Failed to fetch classes", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Classes sans salle attribuée (pour l'alerte administration)
    const classesSansSalle = classes.filter((c) => !c.roomId);

    const libelleClasse = (cls: any) => {
        if (cls.level === "1") return "السابعة أساسي " + cls.name;
        if (cls.level === "2") return "الثامنة أساسي " + cls.name;
        if (cls.level === "3") return "التاسعة أساسي " + cls.name;
        return String(cls.name ?? "");
    };

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Classes</h1>
                    <p className="text-slate-500 mt-1">
                        {isReadOnly
                            ? "Les classes qui vous sont assignées."
                            : "Gestion des classes et des niveaux."}
                    </p>
                </div>
                {!isReadOnly && <Link href="/classes/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
                    <Plus className="w-5 h-5" />
                    Nouvelle Classe
                </Link>}
            </div>

            {/* Aucune classe assignée à cet enseignant */}
            {noClassAssigned && (
                <div className="flex items-start gap-3 p-5 rounded-2xl bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-amber-800">Aucune classe ne vous est assignée</p>
                        <p className="text-sm text-amber-700 mt-1">
                            Contactez l&apos;administration pour être rattaché à une ou plusieurs classes.
                        </p>
                    </div>
                </div>
            )}

            {/* Classes sans salle attribuée (administration uniquement) */}
            {!isReadOnly && classesSansSalle.length > 0 && (
                <div className="flex items-start gap-3 p-5 rounded-2xl bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-bold text-amber-800">
                            {classesSansSalle.length === 1
                                ? "1 classe n'a pas de salle attribuée"
                                : `${classesSansSalle.length} classes n'ont pas de salle attribuée`}
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                            La salle est nécessaire pour la génération de l&apos;emploi du temps.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {classesSansSalle.map((cls) => (
                                <Link
                                    key={cls.id}
                                    href={`/classes/${cls.id}`}
                                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
                                >
                                    {libelleClasse(cls)}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((cls) => {
                    const studentCount = cls.students ? cls.students.length : 0;
                    const name = libelleClasse(cls);
                    return (
                        <div key={cls.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <School className="w-6 h-6" />
                                </div>
                                {studentCount > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-xs font-bold">
                                        <Users className="w-3.5 h-3.5" />
                                        <span>{studentCount} Élèves</span>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-1">{name}</h3>

                            {/* Salle attitrée */}
                            <div className="flex items-center gap-1.5 text-sm mt-2">
                                <MapPin className={`w-3.5 h-3.5 shrink-0 ${cls.room ? "text-slate-400" : "text-amber-500"}`} />
                                {cls.room ? (
                                    <span className="text-slate-500 font-medium">{cls.room.name}</span>
                                ) : (
                                    <span className="text-amber-700 font-medium">Aucune salle</span>
                                )}
                            </div>

                            {!isReadOnly && (
                                <Link href={`/classes/${cls.id}`} className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-indigo-600 font-medium text-sm group-hover:text-indigo-700">
                                    <span>Voir détails</span>
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>

            {classes.length === 0 && !noClassAssigned && (
                <div className="p-12 text-center text-slate-400">
                    <School className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucune classe trouvée.</p>
                </div>
            )}
        </div>
    );
}