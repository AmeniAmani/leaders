"use client";

import { Clock, ChevronLeft, ChevronRight } from "lucide-react";

// ----- Données renvoyées par GET /api/reservations -----

export interface CoursSalle {
    jour: string;
    debut: number;
    fin: number;
    classe: string;
    matiere: string | null;
    enseignant: string | null;
}

export interface Reservation {
    id: number;
    date: string;
    hour: string;
    hourEnd: string;
    duration: number;
    motif: string | null;
    statut: "en_attente" | "validee" | "refusee" | "annulee";
    motifRefus: string | null;
    traiteAt: string | null;
    traitePar: string | null;
    createdAt: string;
    teacherId: number;
    enseignant: string | null;
    classId: number;
    classe: string;
}

export interface SemaineSalle {
    salle: { id: number; name: string | null };
    aujourdhui: string;
    minutes: number;
    lundi: string;
    lundiActuel: string;
    semainesALAvance: number;
    jours: string[];
    heures: string[];
    cours: CoursSalle[];
    reservations: Reservation[];
    demandes: Reservation[];
    enAttente: number;
}

export interface Selection {
    jour: string;
    debut: number; // minutes
    duree: 1 | 2;
}

// ----- Outils -----

export const enMinutes = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
};
export const enHeure = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// "2026-10-01" -> "Jeudi 01/10"
export const libelleJour = (jour: string, annee = false) => {
    const s = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long", day: "2-digit", month: "2-digit", ...(annee ? { year: "numeric" } : {}), timeZone: "UTC",
    }).format(new Date(jour));
    return s.charAt(0).toUpperCase() + s.slice(1);
};

export const ajouterJours = (jour: string, n: number) => {
    const d = new Date(jour);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

export const STATUTS: Record<Reservation["statut"], { libelle: string; style: string }> = {
    en_attente: { libelle: "En attente", style: "bg-amber-100 text-amber-800 border-amber-200" },
    validee:    { libelle: "Validée",    style: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    refusee:    { libelle: "Refusée",    style: "bg-red-100 text-red-700 border-red-200" },
    annulee:    { libelle: "Annulée",    style: "bg-slate-100 text-slate-500 border-slate-200" },
};

const PAUSE = "12:00";

// Une case est-elle déjà passée ?
export const casePassee = (data: SemaineSalle, jour: string, debut: number) =>
    jour < data.aujourdhui || (jour === data.aujourdhui && debut < data.minutes);

// Ce qui occupe une case : cours de l'emploi du temps, réservation validée, demandes en attente
export function contenuCase(data: SemaineSalle, jour: string, debut: number) {
    const fin = debut + 60;
    const cours = data.cours.filter(c => c.jour === jour && c.debut < fin && c.fin > debut);
    const reservations = data.reservations.filter(r => {
        const d = enMinutes(r.hour);
        return r.date === jour && d < fin && d + r.duration * 60 > debut;
    });
    return {
        cours,
        validee: reservations.find(r => r.statut === "validee") || null,
        enAttente: reservations.filter(r => r.statut === "en_attente"),
    };
}

// Une case que l'on ne peut pas demander
export const caseBloquee = (data: SemaineSalle, jour: string, debut: number) => {
    const c = contenuCase(data, jour, debut);
    return casePassee(data, jour, debut) || c.cours.length > 0 || c.validee !== null;
};

// ----- Navigation entre semaines -----

export function NavigationSemaine({ data, onChange, min, max }: {
    data: SemaineSalle;
    onChange: (lundi: string) => void;
    min?: string;
    max?: string;
}) {
    const precedente = ajouterJours(data.lundi, -7);
    const suivante = ajouterJours(data.lundi, 7);
    const fin = ajouterJours(data.lundi, 4);
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => onChange(precedente)}
                disabled={!!min && precedente < min}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Semaine précédente"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-700 tabular-nums whitespace-nowrap">
                Semaine du {libelleJour(data.lundi).split(" ")[1]} au {libelleJour(fin).split(" ")[1]}
            </span>
            <button
                type="button"
                onClick={() => onChange(suivante)}
                disabled={!!max && suivante > max}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Semaine suivante"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
            {data.lundi !== data.lundiActuel && (
                <button
                    type="button"
                    onClick={() => onChange(data.lundiActuel)}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600"
                >
                    Cette semaine
                </button>
            )}
        </div>
    );
}

// ----- Grille : jours en lignes, heures en colonnes, comme l'emploi du temps -----

export default function GrilleSalle({ data, selection, onCaseClick, moi, focusId, onReservationClick }: {
    data: SemaineSalle;
    selection?: Selection | null;
    onCaseClick?: (jour: string, debut: number) => void;
    moi?: number;          // enseignant connecté : ses demandes sont signalées
    focusId?: number | null; // demande mise en évidence (administration)
    onReservationClick?: (id: number) => void;
}) {
    const colonnes = { gridTemplateColumns: `7.5rem repeat(${data.heures.length}, minmax(6.5rem, 1fr))` };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[1100px]">
                    {/* Ligne des heures */}
                    <div style={colonnes} className="grid border-b border-slate-300">
                        <div className="sticky left-0 z-20 h-11 bg-slate-100 border-r border-slate-300 flex items-center justify-center text-slate-400">
                            <Clock className="w-5 h-5" />
                        </div>
                        {data.heures.map(h => (
                            <div
                                key={h}
                                className={`h-11 flex flex-col items-center justify-center border-l border-slate-300 first:border-l-0 ${h === PAUSE ? "bg-slate-200 lunch-hatch" : "bg-slate-100"}`}
                            >
                                <span className="text-[11px] font-bold text-slate-600 tabular-nums whitespace-nowrap">
                                    {h} – {enHeure(enMinutes(h) + 60)}
                                </span>
                                {h === PAUSE && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-none">Pause</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {data.jours.map(jour => (
                        <div key={jour} style={colonnes} className="grid border-b border-slate-200 last:border-b-0">
                            {/* Colonne des jours */}
                            <div className={`sticky left-0 z-10 border-r border-slate-300 flex flex-col items-center justify-center p-2 ${jour === data.aujourdhui ? "bg-indigo-50" : "bg-slate-100"}`}>
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{libelleJour(jour).split(" ")[0]}</span>
                                <span className="text-[11px] text-slate-500 tabular-nums">{libelleJour(jour).split(" ")[1]}</span>
                            </div>

                            {data.heures.map(h => {
                                const debut = enMinutes(h);
                                const passee = casePassee(data, jour, debut);
                                const { cours, validee, enAttente } = contenuCase(data, jour, debut);
                                const bloquee = passee || cours.length > 0 || validee !== null;
                                const choisie = !!selection && selection.jour === jour &&
                                    debut >= selection.debut && debut < selection.debut + selection.duree * 60;
                                const cliquable = !!onCaseClick && !bloquee;

                                return (
                                    <div
                                        key={h}
                                        onClick={cliquable ? () => onCaseClick!(jour, debut) : undefined}
                                        className={`min-h-[4.5rem] border-l border-slate-200 p-1 flex flex-col gap-1 transition-colors ${
                                            choisie ? "bg-emerald-50 ring-2 ring-inset ring-emerald-500" :
                                            passee ? "bg-slate-50 lunch-hatch" :
                                            h === PAUSE ? "lunch-hatch" : ""
                                        } ${cliquable ? "cursor-pointer hover:bg-indigo-50/60" : ""}`}
                                    >
                                        {cours.map((c, i) => (
                                            <div key={i} className="rounded-md bg-slate-200 border border-slate-300 px-1.5 py-1 text-[10px] leading-tight text-slate-700" title="Cours de l'emploi du temps">
                                                <span className="font-bold uppercase">Cours</span>
                                                <span dir="auto" className="block [overflow-wrap:anywhere]">{c.classe}</span>
                                                {c.matiere && <span dir="auto" className="block [overflow-wrap:anywhere] opacity-80">{c.matiere}</span>}
                                            </div>
                                        ))}
                                        {validee && (
                                            <button
                                                type="button"
                                                onClick={onReservationClick ? (e) => { e.stopPropagation(); onReservationClick(validee.id); } : undefined}
                                                className={`text-left rounded-md border px-1.5 py-1 text-[10px] leading-tight ${
                                                    validee.teacherId === moi ? "bg-emerald-600 border-emerald-700 text-white" : "bg-indigo-100 border-indigo-200 text-indigo-800"
                                                } ${focusId === validee.id ? "ring-2 ring-indigo-500" : ""} ${onReservationClick ? "" : "cursor-default"}`}
                                            >
                                                <span className="font-bold uppercase">{validee.teacherId === moi ? "Votre réservation" : "Réservée"}</span>
                                                <span className="block [overflow-wrap:anywhere]">{validee.enseignant}</span>
                                                <span dir="auto" className="block [overflow-wrap:anywhere]">{validee.classe}</span>
                                            </button>
                                        )}
                                        {enAttente.map(r => (
                                            <button
                                                type="button"
                                                key={r.id}
                                                onClick={onReservationClick ? (e) => { e.stopPropagation(); onReservationClick(r.id); } : undefined}
                                                className={`text-left rounded-md border border-dashed px-1.5 py-1 text-[10px] leading-tight ${
                                                    r.teacherId === moi ? "bg-amber-200 border-amber-500 text-amber-900" : "bg-amber-50 border-amber-300 text-amber-800"
                                                } ${focusId === r.id ? "ring-2 ring-amber-500" : ""} ${onReservationClick ? "" : "cursor-default"}`}
                                            >
                                                <span className="font-bold uppercase">{r.teacherId === moi ? "Votre demande" : "Demande en attente"}</span>
                                                <span className="block [overflow-wrap:anywhere]">{r.enseignant}</span>
                                                <span dir="auto" className="block [overflow-wrap:anywhere]">{r.classe}</span>
                                            </button>
                                        ))}
                                        {choisie && (
                                            <span className="mt-auto text-[10px] font-bold text-emerald-700 uppercase">Votre choix</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Légende */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-slate-200 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 border border-slate-300" />Cours</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200" />Réservée</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-dashed border-amber-300" />Demande en attente</span>
                {onCaseClick && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 ring-2 ring-emerald-500" />Votre choix</span>}
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-50 lunch-hatch border border-slate-200" />Passé</span>
            </div>

            <style jsx global>{`
                .lunch-hatch {
                    background-image: repeating-linear-gradient(135deg, rgba(100, 116, 139, 0.14) 0 6px, transparent 6px 12px);
                }
            `}</style>
        </div>
    );
}
