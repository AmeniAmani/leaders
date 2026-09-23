"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Save } from "lucide-react";

// Réglage annuel : premier jour d'une semaine A (la rentrée)
export function SemaineReference() {
    const [reference, setReference] = useState("");
    const [semaineActuelle, setSemaineActuelle] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/settings/semaine-a", { cache: "no-store" })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data) return;
                setReference(data.reference);
                setSemaineActuelle(data.semaineActuelle);
            })
            .catch(() => setMessage("Impossible de charger le réglage."));
    }, []);

    const enregistrer = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/settings/semaine-a", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSemaineActuelle(data.semaineActuelle);
            setMessage("Enregistré.");
        } catch (err) {
            setMessage(err instanceof Error && err.message ? err.message : "Erreur lors de l'enregistrement.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-500" />
                <h2 className="font-bold text-slate-900">Semaines A / B</h2>
            </div>
            <p className="text-sm text-slate-500">
                Indiquez un jour de la première semaine A de l&apos;année (la rentrée). Les semaines
                alternent ensuite A, B, A, B… sans interruption. À régler une fois par an.
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="date"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
                <button
                    type="button"
                    onClick={enregistrer}
                    disabled={isSaving || !reference}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-60"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                </button>
                {semaineActuelle && (
                    <span className="text-sm text-slate-600">
                        Cette semaine : <strong>semaine {semaineActuelle}</strong>
                    </span>
                )}
            </div>
            {message && <p className="text-sm text-slate-500">{message}</p>}
        </div>
    );
}
