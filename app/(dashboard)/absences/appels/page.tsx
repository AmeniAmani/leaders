"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, CalendarDays, Loader2, RefreshCw, ClipboardCheck } from "lucide-react";
import Link from "next/link";

type Statut = "fait" | "non_fait" | "enseignant_absent" | "a_venir";

interface Classe {
    id: number;
    name: string | null;
    level: string | null;
}
interface LigneCours {
    id: number;
    start: string;
    debut: number;
    fin: number;
    classe: Classe | null;
    subjectName: string | null;
    teacher: { id: number; name: string | null } | null;
    statut: Statut;
    appel: {
        hour: string;
        hourEnd: string;
        faitPar: string;
        teacherName: string | null;
        nbSignales: number;
        source: string;
        createdAt: string;
        updatedAt: string;
    } | null;
}
interface AppelHors {
    id: number;
    hour: string;
    hourEnd: string;
    classe: Classe | null;
    teacherName: string | null;
    faitPar: string;
    nbSignales: number;
    source: string;
    createdAt: string;
}
interface ResumeProf {
    teacherId: number;
    name: string | null;
    faits: number;
    dus: number;
    aVenir: number;
    absent: number;
}
interface Donnees {
    date: string;
    jour: string;
    cours: LigneCours[];
    horsEmploiDuTemps: AppelHors[];
    parEnseignant: ResumeProf[];
}

const classLabel = (c?: Classe | null) => {
    if (!c) return "";
    const prefix =
        c.level === "1" ? "السابعة أساسي " :
        c.level === "2" ? "الثامنة أساسي " :
        c.level === "3" ? "التاسعة أساسي " : "";
    return prefix + (c.name || "");
};

// 510 -> "08:30"
const enHeure = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Heure de l'école, quel que soit le fuseau de l'appareil
const heureDe = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });

const todayLocal = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
};

const STATUTS: Record<Statut, { libelle: string; style: string }> = {
    fait:              { libelle: "Fait",              style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    non_fait:          { libelle: "Non fait",          style: "bg-red-50 text-red-700 border-red-200" },
    enseignant_absent: { libelle: "Enseignant absent", style: "bg-amber-50 text-amber-700 border-amber-200" },
    a_venir:           { libelle: "À venir",           style: "bg-slate-50 text-slate-500 border-slate-200" },
};

const Badge = ({ statut }: { statut: Statut }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold whitespace-nowrap ${STATUTS[statut].style}`}>
        {STATUTS[statut].libelle}
    </span>
);

// Appel repris de l'historique plutôt que saisi après la mise en place
const Reprise = ({ source }: { source: string }) => source === "saisie" ? null : (
    <span className="ml-1.5 text-[10px] font-medium text-slate-400" title="Appel reconstitué à partir de l'historique">
        (repris)
    </span>
);

type Filtre = "tous" | Statut;

export default function AppelsDuJourPage() {
    const [date, setDate] = useState(todayLocal());
    const [data, setData] = useState<Donnees | null>(null);
    const [erreur, setErreur] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [filtre, setFiltre] = useState<Filtre>("tous");

    const charger = useCallback(async () => {
        if (!date) return;
        setIsLoading(true);
        setErreur(null);
        try {
            const res = await fetch(`/api/absences/appels?date=${date}`, { cache: "no-store" });
            const d = await res.json();
            if (!res.ok) {
                setData(null);
                setErreur(d?.error || "Une erreur est survenue");
                return;
            }
            setData(d);
        } catch {
            setData(null);
            setErreur("Une erreur est survenue");
        } finally {
            setIsLoading(false);
        }
    }, [date]);

    useEffect(() => { charger(); }, [charger]);

    const cours = data?.cours || [];
    const compte = (s: Statut) => cours.filter(c => c.statut === s).length;
    const affiches = filtre === "tous" ? cours : cours.filter(c => c.statut === filtre);

    return (
        <div className="space-y-6">
            {/* Titre */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/absences" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Appels du jour</h1>
                        <p className="text-slate-500 text-sm">Pour chaque cours de l&apos;emploi du temps : l&apos;appel a-t-il été fait, et par qui.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-slate-700"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={charger}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-40"
                        title="Actualiser"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {isLoading && !data && (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            {erreur && (
                <div className="p-6 text-center text-red-600 bg-red-50 rounded-2xl border border-red-100">{erreur}</div>
            )}

            {data && !erreur && (
                <>
                    {/* Filtres par statut */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {(["tous", "non_fait", "fait", "enseignant_absent", "a_venir"] as Filtre[]).map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFiltre(f)}
                                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                                    filtre === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                {f === "tous" ? "Tous" : STATUTS[f].libelle}
                                <span className={`ml-1.5 text-xs ${filtre === f ? "text-white/70" : "text-slate-400"}`}>
                                    {f === "tous" ? cours.length : compte(f)}
                                </span>
                            </button>
                        ))}
                        <span className="text-sm text-slate-400 ml-auto">
                            {data.jour} {new Date(data.date).toLocaleDateString("fr-FR", { timeZone: "UTC" })}
                        </span>
                    </div>

                    {/* Cours du jour */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        {cours.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Aucun cours à l&apos;emploi du temps ce jour-là.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-4 py-3 whitespace-nowrap">Horaire</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Classe</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Matière</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Enseignant prévu</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Appel</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Fait par</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-center">Signalés</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {affiches.map(c => (
                                            <tr key={c.id} className={c.statut === "non_fait" ? "bg-red-50/30" : ""}>
                                                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                                                    {enHeure(c.debut)} – {enHeure(c.fin)}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap"><bdi>{classLabel(c.classe)}</bdi></td>
                                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap"><bdi>{c.subjectName || "—"}</bdi></td>
                                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.teacher?.name || "—"}</td>
                                                <td className="px-4 py-3 whitespace-nowrap"><Badge statut={c.statut} /></td>
                                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                    {c.appel ? (
                                                        <>
                                                            <span className="font-medium text-slate-800">{c.appel.faitPar}</span>
                                                            <span className="text-slate-400"> · {c.appel.hour}–{c.appel.hourEnd}, à {heureDe(c.appel.createdAt)}</span>
                                                            <Reprise source={c.appel.source} />
                                                        </>
                                                    ) : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                                    {c.appel ? (
                                                        <span className={`font-bold ${c.appel.nbSignales > 0 ? "text-red-600" : "text-slate-300"}`}>
                                                            {c.appel.nbSignales}
                                                        </span>
                                                    ) : ""}
                                                </td>
                                            </tr>
                                        ))}
                                        {affiches.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun cours avec ce statut.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Résumé par enseignant */}
                    {data.parEnseignant.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-lg font-bold text-slate-900">Par enseignant</h2>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[640px] text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                <th className="px-4 py-3 whitespace-nowrap">Enseignant</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-center">Appels faits</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-center">Non faits</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-center">À venir</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-center">Absent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {data.parEnseignant.map(p => (
                                                <tr key={p.teacherId}>
                                                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.name || "—"}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                                        <span className="font-bold text-slate-800">{p.faits}</span>
                                                        <span className="text-slate-400"> / {p.dus}</span>
                                                    </td>
                                                    <td className={`px-4 py-3 text-center font-bold whitespace-nowrap ${p.dus - p.faits > 0 ? "text-red-600" : "text-slate-300"}`}>
                                                        {p.dus - p.faits}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-500 whitespace-nowrap">{p.aVenir || ""}</td>
                                                    <td className="px-4 py-3 text-center text-amber-600 whitespace-nowrap">{p.absent || ""}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Appels sans cours correspondant */}
                    {data.horsEmploiDuTemps.length > 0 && (
                        <div className="space-y-3">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Appels hors emploi du temps</h2>
                                <p className="text-slate-500 text-sm">Appels saisis sur un créneau où l&apos;emploi du temps ne prévoit pas de cours pour la classe.</p>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                <th className="px-4 py-3 whitespace-nowrap">Créneau</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Classe</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Enseignant</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Fait par</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-center">Signalés</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {data.horsEmploiDuTemps.map(a => (
                                                <tr key={a.id}>
                                                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{a.hour} – {a.hourEnd}</td>
                                                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap"><bdi>{classLabel(a.classe)}</bdi></td>
                                                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{a.teacherName || "—"}</td>
                                                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                        <span className="font-medium text-slate-800">{a.faitPar}</span>
                                                        <span className="text-slate-400"> · à {heureDe(a.createdAt)}</span>
                                                        <Reprise source={a.source} />
                                                    </td>
                                                    <td className={`px-4 py-3 text-center font-bold whitespace-nowrap ${a.nbSignales > 0 ? "text-red-600" : "text-slate-300"}`}>
                                                        {a.nbSignales}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
