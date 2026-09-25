"use client";

import { TexteMixte } from "@/components/ui/TexteMixte";
import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Loader2, Activity as ActivityIcon, User, CalendarDays, X } from "lucide-react";
import { motion } from "framer-motion";

interface ActivityItem {
    id: number;
    nameUser: string | null;
    description: string | null;
    dateActivity: string;
}

// Cle du jour en heure locale, ex : 2026-09-16
const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatHeure = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const libelleJour = (key: string) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (key === dayKey(today)) return "Aujourd'hui";
    if (key === dayKey(yesterday)) return "Hier";
    const [y, m, d] = key.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const couleur = (description: string) => {
    if (description.includes("supprimé")) return "text-red-500";
    if (description.includes("modifié")) return "text-yellow-600";
    return "text-slate-700";
};

export default function ActivitiesPage() {
    const currentYear = String(new Date().getFullYear());

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedDate, setSelectedDate] = useState(""); // vide = pas de filtre par jour
    const [years, setYears] = useState<string[]>([currentYear]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Annees disponibles, chargees une seule fois
    useEffect(() => {
        fetch("/api/activities/all?years=1")
            .then((res) => (res.ok ? res.json() : []))
            .then((data: string[]) => {
                const all = Array.from(new Set([currentYear, ...data])).sort((a, b) => b.localeCompare(a));
                setYears(all);
            })
            .catch(() => {});
    }, []);

    // Chargement : le jour choisi, sinon l'annee choisie
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);

            let from: Date;
            let to: Date;
            if (selectedDate) {
                const [y, m, d] = selectedDate.split("-").map(Number);
                from = new Date(y, m - 1, d);
                to = new Date(y, m - 1, d + 1);
            } else {
                const y = Number(selectedYear);
                from = new Date(y, 0, 1);
                to = new Date(y + 1, 0, 1);
            }

            try {
                const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
                const res = await fetch(`/api/activities/all?${params}`);
                if (!res.ok) throw new Error();
                setActivities(await res.json());
            } catch {
                setError("Impossible de charger les activités.");
                setActivities([]);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [selectedDate, selectedYear]);

    // Filtre par utilisateur, puis regroupement par jour (deja trie par l API)
    const groupes = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const map = new Map<string, ActivityItem[]>();
        for (const a of activities) {
            if (term && !(a.nameUser ?? "").toLowerCase().includes(term)) continue;
            const key = dayKey(new Date(a.dateActivity));
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(a);
        }
        return Array.from(map.entries());
    }, [activities, searchTerm]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Activités récentes</h1>
                <p className="text-slate-500 mt-1">Historique des actions, jour par jour.</p>
            </div>

            {/* Filtres */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                {/* Recherche par utilisateur */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Rechercher par utilisateur..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* Jour precis */}
                    <div className="relative flex-1 md:flex-none">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                        <input
                            type="date"
                            value={selectedDate}
                            max={dayKey(new Date())}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        />
                    </div>
                    {selectedDate && (
                        <button
                            type="button"
                            onClick={() => setSelectedDate("")}
                            title="Effacer la date"
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200/50 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    {/* Annee */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                        <select
                            value={selectedYear}
                            disabled={!!selectedDate}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="appearance-none pl-10 pr-8 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Liste par jour */}
            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            ) : groupes.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
                    <ActivityIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>
                        {selectedDate
                            ? "Aucune activité ce jour-là."
                            : "Aucune activité trouvée."}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groupes.map(([key, list], gi) => (
                        <motion.section
                            key={key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(gi, 8) * 0.05 }}
                            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                        >
                            {/* En-tete du jour */}
                            <div className="flex items-center justify-between px-5 py-3 bg-slate-50/70 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-indigo-500" />
                                    <h2 className="font-bold text-slate-800">{libelleJour(key)}</h2>
                                </div>
                                <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
                                    {list.length} {list.length > 1 ? "activités" : "activité"}
                                </span>
                            </div>

                            {/* Activites du jour */}
                            <ul className="divide-y divide-slate-50">
                                {list.map((a) => {
                                    const d = new Date(a.dateActivity);
                                    return (
                                        <li
                                            key={a.id}
                                            className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-5 py-3 hover:bg-slate-50/80 transition-colors ${couleur(a.description ?? "")}`}
                                        >
                                            <span className="text-sm font-mono font-semibold sm:w-12 shrink-0 sm:pt-0.5">
                                                {formatHeure(d)}
                                            </span>
                                            <div className="flex items-center gap-2 sm:w-44 shrink-0">
                                                <div className="p-1.5 bg-slate-100 rounded-full">
                                                    <User className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-sm font-semibold truncate">
                                                    {a.nameUser || "Non assigné"}
                                                </span>
                                            </div>
                                            <span className="text-sm font-medium flex-1"><TexteMixte texte={a.description} /></span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </motion.section>
                    ))}
                </div>
            )}
        </div>
    );
}