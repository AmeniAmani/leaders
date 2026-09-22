"use client";

import { useState } from "react";
import { ChevronLeft, Save, BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NIVEAUX = [
    { cle: "hoursLevel1", court: "7ème", long: "السابعة أساسي" },
    { cle: "hoursLevel2", court: "8ème", long: "الثامنة أساسي" },
    { cle: "hoursLevel3", court: "9ème", long: "التاسعة أساسي" },
];

export default function NewSubjectPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [heures, setHeures] = useState<Record<string, string>>({
        hoursLevel1: "",
        hoursLevel2: "",
        hoursLevel3: "",
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);

        const nom = String(formData.get("name") || "").trim();
        if (!nom) { alert("Le nom de la matière est obligatoire."); return; }

        // Au moins un niveau doit avoir un volume horaire
        const renseignes = NIVEAUX.filter(n => heures[n.cle] && Number(heures[n.cle]) > 0);
        if (renseignes.length === 0) {
            alert("Indiquez le nombre d'heures par semaine pour au moins un niveau.");
            return;
        }

        const data = {
            name: nom,
            codematiere: formData.get("codematiere"),
            hoursLevel1: heures.hoursLevel1 ? Number(heures.hoursLevel1) : null,
            hoursLevel2: heures.hoursLevel2 ? Number(heures.hoursLevel2) : null,
            hoursLevel3: heures.hoursLevel3 ? Number(heures.hoursLevel3) : null,
        };

        setIsLoading(true);
        try {
            const res = await fetch("/api/subjects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                let message = "Erreur lors de la création";
                try {
                    const erreur = await res.json();
                    if (erreur?.error) message = erreur.error;
                } catch {
                    // réponse non JSON : on garde le message générique
                }
                throw new Error(message);
            }

            router.push("/subjects");
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error?.message || "Une erreur est survenue lors de la création.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
                <Link
                    href="/subjects"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nouvelle Matière</h1>
                    <p className="text-slate-500 text-sm">Ajouter une matière au programme.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                    <BookOpen className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Détails de la Matière</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                            Nom de la Matière<span className="text-red-500">*</span>
                        </label>
                        <input
                            name="name"
                            type="text"
                            placeholder="Ex: Informatique"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Identifiant Matière (Eduserv)</label>
                        <input
                            name="codematiere"
                            type="text"
                            placeholder="Ex: Mat001"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                        />
                    </div>
                </div>

                {/* Volume horaire par niveau */}
                <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-indigo-600">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-bold text-lg">
                            Heures par semaine<span className="text-red-500">*</span>
                        </h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-5">
                        Laissez vide un niveau où la matière n&apos;est pas enseignée.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {NIVEAUX.map(n => (
                            <div key={n.cle} className="space-y-2">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">{n.court}</span>
                                    <span className="block text-xs text-slate-400">{n.long}</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="40"
                                        value={heures[n.cle]}
                                        onChange={(e) => setHeures(prev => ({ ...prev, [n.cle]: e.target.value }))}
                                        placeholder="—"
                                        className="w-full px-4 py-2.5 pr-12 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-center font-bold"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                                        h
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                    <p className="mr-auto text-xs text-slate-400">
                        Les champs marqués d&apos;un <span className="text-red-500">*</span> sont obligatoires.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                    >
                        {isLoading ? "..." : (
                            <>
                                <Save className="w-4 h-4" />
                                Créer
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}