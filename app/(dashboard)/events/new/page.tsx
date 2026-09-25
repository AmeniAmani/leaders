"use client";

import { useState } from "react";
import { ChevronLeft, Save, CalendarArrowDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

export default function NeweventsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch("/api/events", {
                method: "POST",
                body: JSON.stringify({ 
                    name: formData.get("name"), 
                    target: formData.get("target"), 
                    dateEvent: formData.get("dateEvent"), 
                    description: formData.get("description") 
                }),
            });

            if (!res.ok) throw new Error(await messageErreur(res));

            router.push("/events");
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
                <Link
                    href="/events"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nouvel Evénement</h1>
                    <p className="text-slate-500 text-sm">Ajouter un Evénement.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                    <CalendarArrowDown className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Détails de l'Evénement</h3>
                </div>

                <div className="space-y-4">
                    {/** Nom */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nom de l'Evénement<span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="name"
                            placeholder="Ex: Conseil de classe / Sortie ..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/** Cible */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Publique cible</label>
                            <select name="target" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
                                <option value="1">Parent</option>
                                <option value="2">Enseignant</option>
                                <option value="3">Parent/Enseignant</option>
                            </select>
                        </div>
                        {/** Date */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Date de l'Evénement<span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                name="dateEvent"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                    </div>
                    </div>
                        {/** Description */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Description</label>
                                <textarea
                                    name="description"
                                    placeholder="Ex: Description"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
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
                                Créer la Evenement
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
