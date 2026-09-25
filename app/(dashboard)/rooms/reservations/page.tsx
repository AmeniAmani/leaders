"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Clapperboard, Loader2, Trash2, X } from "lucide-react";
import GrilleSalle, { NavigationSemaine, Reservation, STATUTS, SemaineSalle, libelleJour } from "@/components/reservations/GrilleSalle";

const dateHeure = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Administration : demandes de réservation de la salle de cinéma, à valider ou refuser
export default function ReservationsSallePage() {
    const [data, setData] = useState<SemaineSalle | null>(null);
    const [erreur, setErreur] = useState<string | null>(null);
    const [semaine, setSemaine] = useState<string | null>(null);
    const [focusId, setFocusId] = useState<number | null>(null);
    const [traitementId, setTraitementId] = useState<number | null>(null);

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

    // Une nouvelle demande arrive pendant que la page est ouverte
    useEffect(() => {
        const timer = setInterval(charger, 30000);
        window.addEventListener("focus", charger);
        return () => {
            clearInterval(timer);
            window.removeEventListener("focus", charger);
        };
    }, [charger]);

    // Afficher une demande dans la grille
    const voir = (r: Reservation) => {
        setFocusId(r.id);
        setSemaine(r.date);
    };

    const traiter = async (r: Reservation, action: "valider" | "refuser") => {
        const creneau = `${libelleJour(r.date, true)} de ${r.hour} à ${r.hourEnd}`;
        let motifRefus: string | null = null;
        if (action === "valider") {
            if (!window.confirm(`Valider la réservation de ${r.enseignant} (${r.classe}) : ${creneau} ?\n\nLes autres demandes en attente sur ce créneau seront refusées.`)) return;
        } else {
            motifRefus = window.prompt(`Refuser la demande de ${r.enseignant} (${creneau}).\n\nMotif du refus (facultatif) :`, "");
            if (motifRefus === null) return;
        }
        setTraitementId(r.id);
        try {
            const res = await fetch(`/api/reservations/${r.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, motifRefus }),
            });
            const json = await res.json();
            if (!res.ok) alert(json.error || "Erreur lors du traitement");
            else if (json.refusees > 0) alert(`${json.refusees} autre(s) demande(s) sur ce créneau ont été refusées automatiquement.`);
            charger();
            // La cloche se met à jour
            window.dispatchEvent(new Event("admin-alerts:refresh"));
        } finally {
            setTraitementId(null);
        }
    };

    // Demande refusée ou annulée : on efface la ligne, elle disparaît aussi chez l'enseignant
    const supprimer = async (r: Reservation) => {
        const creneau = `${libelleJour(r.date, true)} de ${r.hour} à ${r.hourEnd}`;
        if (!window.confirm(`Supprimer définitivement la demande ${r.statut === "refusee" ? "refusée" : "annulée"} de ${r.enseignant} (${r.classe}) : ${creneau} ?\n\nElle disparaîtra aussi de la page de l'enseignant.`)) return;
        setTraitementId(r.id);
        try {
            const res = await fetch(`/api/reservations/${r.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) alert(json.error || "Erreur lors de la suppression");
            if (focusId === r.id) setFocusId(null);
            charger();
            window.dispatchEvent(new Event("admin-alerts:refresh"));
        } finally {
            setTraitementId(null);
        }
    };

    if (!data) {
        return (
            <div className="flex h-96 items-center justify-center">
                {erreur ? <p className="text-slate-500">{erreur}</p> : <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />}
            </div>
        );
    }

    const enAttente = data.demandes.filter(r => r.statut === "en_attente");
    const traitees = data.demandes.filter(r => r.statut !== "en_attente").reverse();

    const tableau = (lignes: Reservation[], actions: boolean) => (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase">
                    <tr>
                        <th className="px-3 py-3">Enseignant</th>
                        <th className="px-3 py-3">Classe</th>
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3">Horaire</th>
                        <th className="px-3 py-3">Motif</th>
                        <th className="px-3 py-3 whitespace-nowrap">{actions ? "Demandée le" : "État"}</th>
                        <th className="px-3 py-3"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {lignes.map(r => (
                        <tr
                            key={r.id}
                            onClick={() => voir(r)}
                            className={`cursor-pointer hover:bg-slate-50 ${focusId === r.id ? "bg-indigo-50/60" : ""}`}
                        >
                            <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">{r.enseignant}</td>
                            <td dir="auto" className="px-3 py-3 whitespace-nowrap">{r.classe}</td>
                            <td className="px-3 py-3 whitespace-nowrap">{libelleJour(r.date, true)}</td>
                            <td className="px-3 py-3 whitespace-nowrap tabular-nums">{r.hour} – {r.hourEnd}</td>
                            <td className="px-3 py-3 text-slate-600">{r.motif || "—"}</td>
                            <td className="px-3 py-3 whitespace-nowrap">
                                {actions ? (
                                    <span className="text-slate-500 tabular-nums">{dateHeure(r.createdAt)}</span>
                                ) : (
                                    <>
                                        <span className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-bold ${STATUTS[r.statut].style}`}>
                                            {STATUTS[r.statut].libelle}
                                        </span>
                                        <span className="block text-[11px] text-slate-400 mt-0.5">
                                            {r.traitePar}{r.traiteAt ? `, ${dateHeure(r.traiteAt)}` : ""}
                                        </span>
                                        {r.statut === "refusee" && r.motifRefus && (
                                            <span className="block text-[11px] text-red-600">{r.motifRefus}</span>
                                        )}
                                    </>
                                )}
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                {actions && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => traiter(r, "refuser")}
                                            disabled={traitementId === r.id}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                            Refuser
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => traiter(r, "valider")}
                                            disabled={traitementId === r.id}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
                                        >
                                            {traitementId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                            Valider
                                        </button>
                                    </>
                                )}
                                {(r.statut === "refusee" || r.statut === "annulee") && (
                                    <button
                                        type="button"
                                        onClick={() => supprimer(r)}
                                        disabled={traitementId === r.id}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

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
                            Réservations — <bdi>{data.salle.name || "Salle de cinéma"}</bdi>
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Une réservation n&apos;est confirmée qu&apos;après votre validation. Cliquez sur une demande pour la voir dans la grille.
                        </p>
                    </div>
                </div>
                <NavigationSemaine data={data} onChange={lundi => { setSemaine(lundi); setFocusId(null); }} />
            </div>

            <GrilleSalle data={data} focusId={focusId} onReservationClick={id => setFocusId(id)} />

            {/* Demandes en attente */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <h2 className="px-5 py-4 font-bold text-slate-900 border-b border-slate-100 flex items-center gap-2">
                    Demandes en attente
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${enAttente.length > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                        {enAttente.length}
                    </span>
                </h2>
                {enAttente.length === 0
                    ? <p className="px-5 py-6 text-sm text-slate-500">Aucune demande en attente.</p>
                    : tableau(enAttente, true)}
            </div>

            {/* Historique */}
            {traitees.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <h2 className="px-5 py-4 font-bold text-slate-900 border-b border-slate-100">Demandes traitées (30 derniers jours)</h2>
                    {tableau(traitees, false)}
                </div>
            )}
        </div>
    );
}
