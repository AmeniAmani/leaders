"use client";

import { isoler } from "@/lib/bidi";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Clapperboard, Loader2, Send, X } from "lucide-react";
import GrilleSalle, {
    NavigationSemaine, STATUTS, SemaineSalle, Selection,
    ajouterJours, caseBloquee, enHeure, libelleJour,
} from "@/components/reservations/GrilleSalle";

interface Classe {
    id: number;
    name: string;
    level: string;
}

const getCookie = (name: string) => {
    if (typeof document === "undefined") return null;
    return document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="))
        ?.split("=")[1] ?? null;
};

const libelleClasse = (c: Classe) =>
    (c.level === "1" ? "السابعة أساسي " : c.level === "2" ? "الثامنة أساسي " : c.level === "3" ? "التاسعة أساسي " : "") + c.name;

// Enseignant : demande de réservation de la salle de cinéma, validée ensuite par l'administration
export default function ReserverCinemaPage() {
    const [data, setData] = useState<SemaineSalle | null>(null);
    const [erreur, setErreur] = useState<string | null>(null);
    const [semaine, setSemaine] = useState<string | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [classes, setClasses] = useState<Classe[]>([]);
    const [classId, setClassId] = useState("");
    const [motif, setMotif] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [annulationId, setAnnulationId] = useState<number | null>(null);
    const [moi, setMoi] = useState<number | undefined>(undefined);

    const charger = useCallback(async () => {
        try {
            const res = await fetch(`/api/reservations${semaine ? `?semaine=${semaine}` : ""}`, { cache: "no-store" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Erreur de chargement");
            setData(json);
            setErreur(null);
        } catch (e) {
            setErreur(e instanceof Error ? e.message : "Erreur de chargement");
        }
    }, [semaine]);

    useEffect(() => { charger(); }, [charger]);

    // Ses classes, pour la demande
    useEffect(() => {
        const id = getCookie("user-id");
        if (!id) return;
        setMoi(Number(id));
        fetch(`/api/classes/teacher/${id}`)
            .then(r => r.ok ? r.json() : [])
            .then((l: Classe[]) => {
                const liste = Array.isArray(l) ? l : [];
                setClasses(liste);
                if (liste.length === 1) setClassId(String(liste[0].id));
            })
            .catch(() => setClasses([]));
    }, []);

    // Une heure, ou deux heures consécutives le même jour
    const choisirCase = (jour: string, debut: number) => {
        if (!data) return;
        setSelection(prev => {
            if (prev && prev.jour === jour) {
                // Clic dans la sélection : on la retire
                if (debut >= prev.debut && debut < prev.debut + prev.duree * 60) return null;
                if (prev.duree === 1 && debut === prev.debut + 60) return { jour, debut: prev.debut, duree: 2 };
                if (prev.duree === 1 && debut === prev.debut - 60) return { jour, debut, duree: 2 };
            }
            return { jour, debut, duree: 1 };
        });
    };

    const changerSemaine = (lundi: string) => {
        setSemaine(lundi);
        setSelection(null);
    };

    const envoyer = async () => {
        if (!selection || !classId) return;
        setEnvoi(true);
        try {
            const res = await fetch("/api/reservations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: selection.jour,
                    hour: enHeure(selection.debut),
                    duration: selection.duree,
                    classId: Number(classId),
                    motif,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Erreur lors de l'envoi");
            alert("Demande envoyée à l'administration. La réservation sera confirmée après sa validation.");
            setSelection(null);
            setMotif("");
            charger();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur lors de l'envoi");
            charger();
        } finally {
            setEnvoi(false);
        }
    };

    const annuler = async (id: number, validee: boolean) => {
        if (!window.confirm(validee
            ? "Annuler cette réservation validée ? Le créneau sera libéré et l'administration en sera informée."
            : "Annuler cette demande ?")) return;
        setAnnulationId(id);
        try {
            const res = await fetch(`/api/reservations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "annuler" }),
            });
            const json = await res.json();
            if (!res.ok) alert(json.error || "Erreur lors de l'annulation");
            charger();
        } finally {
            setAnnulationId(null);
        }
    };

    if (!data) {
        return (
            <div className="flex h-96 items-center justify-center">
                {erreur ? <p className="text-slate-500">{erreur}</p> : <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />}
            </div>
        );
    }

    // La sélection devient impossible si la grille a changé entre-temps
    const selectionValide = !!selection &&
        !caseBloquee(data, selection.jour, selection.debut) &&
        (selection.duree === 1 || !caseBloquee(data, selection.jour, selection.debut + 60));
    const aVenir = (r: { date: string; hour: string }) =>
        r.date > data.aujourdhui || (r.date === data.aujourdhui && Number(r.hour.slice(0, 2)) * 60 > data.minutes);

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/rooms" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Clapperboard className="w-6 h-6 text-indigo-500" />
                            Réserver la <bdi>{data.salle.name || "salle de cinéma"}</bdi>
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Choisissez une heure, ou deux heures de suite le même jour. La réservation est confirmée après validation par l&apos;administration.
                        </p>
                    </div>
                </div>
                <NavigationSemaine
                    data={data}
                    onChange={changerSemaine}
                    min={data.lundiActuel}
                    max={ajouterJours(data.lundiActuel, data.semainesALAvance * 7)}
                />
            </div>

            <GrilleSalle data={data} selection={selection} onCaseClick={choisirCase} moi={moi} />

            {/* Demande */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                {!selection ? (
                    <p className="text-sm text-slate-500">Cliquez sur une case libre de la grille pour choisir le créneau.</p>
                ) : (
                    <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                        <div className="lg:w-64">
                            <p className="text-xs font-medium text-slate-500">Créneau choisi</p>
                            <p className="font-bold text-slate-900">
                                {libelleJour(selection.jour, true)}
                            </p>
                            <p className="text-sm text-slate-700 tabular-nums">
                                de {enHeure(selection.debut)} à {enHeure(selection.debut + selection.duree * 60)} ({selection.duree} h)
                            </p>
                        </div>
                        <div className="space-y-1 lg:w-64">
                            <label className="text-sm font-medium text-slate-700">Classe<span className="text-red-500">*</span></label>
                            <select
                                value={classId}
                                onChange={e => setClassId(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="">Sélectionner une classe...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{isoler(libelleClasse(c))}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1 flex-1">
                            <label className="text-sm font-medium text-slate-700">Motif (facultatif)</label>
                            <input
                                type="text"
                                maxLength={200}
                                value={motif}
                                onChange={e => setMotif(e.target.value)}
                                placeholder="Ex. : projection d'un film"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSelection(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                            >
                                Effacer
                            </button>
                            <button
                                type="button"
                                onClick={envoyer}
                                disabled={envoi || !classId || !selectionValide}
                                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                            >
                                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Envoyer la demande
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mes demandes */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <h2 className="px-5 py-4 font-bold text-slate-900 border-b border-slate-100">Mes demandes</h2>
                {data.demandes.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-500">Aucune demande pour le moment.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Horaire</th>
                                    <th className="px-4 py-3">Classe</th>
                                    <th className="px-4 py-3">Motif</th>
                                    <th className="px-4 py-3">État</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.demandes.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <button type="button" className="hover:text-indigo-600" onClick={() => changerSemaine(r.date)}>
                                                {libelleJour(r.date, true)}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">{r.hour} – {r.hourEnd}</td>
                                        <td dir="auto" className="px-4 py-3 whitespace-nowrap">{r.classe}</td>
                                        <td className="px-4 py-3 text-slate-600">{r.motif || "—"}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-bold whitespace-nowrap ${STATUTS[r.statut].style}`}>
                                                {STATUTS[r.statut].libelle}
                                            </span>
                                            {r.statut === "refusee" && r.motifRefus && (
                                                <p className="text-xs text-red-600 mt-1">{r.motifRefus}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {(r.statut === "en_attente" || r.statut === "validee") && aVenir(r) && (
                                                <button
                                                    type="button"
                                                    onClick={() => annuler(r.id, r.statut === "validee")}
                                                    disabled={annulationId === r.id}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {annulationId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                                    Annuler
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
