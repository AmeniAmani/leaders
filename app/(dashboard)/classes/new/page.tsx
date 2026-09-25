"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect } from "react";
import { ChevronLeft, Save, School, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

export default function NewClassPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Salles disponibles (non encore attribuées à une classe)
    const [rooms, setRooms] = useState<any[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const [roomsRes, classesRes] = await Promise.all([
                    fetch("/api/rooms"),
                    fetch("/api/classes"),
                ]);

                if (roomsRes.ok && classesRes.ok) {
                    const allRooms = await roomsRes.json();
                    const allClasses = await classesRes.json();

                    // Une salle ne peut être attribuée qu'à une seule classe
                    const takenIds = new Set(
                        allClasses.map((c: any) => c.roomId).filter(Boolean)
                    );
                    setRooms(allRooms.filter((r: any) => !takenIds.has(r.id)));
                }
            } catch (error) {
                console.error("Failed to fetch rooms", error);
            } finally {
                setIsLoadingRooms(false);
            }
        };
        fetchRooms();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch("/api/classes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.get("name"),
                    level: formData.get("level"),
                    codeclass: formData.get("codeclass"),
                    roomId: formData.get("roomId"),
                }),
            });

            if (!res.ok) throw new Error(await messageErreur(res));

            router.push("/classes");
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
                    href="/classes"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nouvelle Classe</h1>
                    <p className="text-slate-500 text-sm">Créer un nouveau groupe classe.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                {/* Class Details Section */}
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                    <School className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Détails de la Classe</h3>
                </div>
                <div className="mt-6 space-y-3">
                    {/* Level  */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Niveau<span className="text-red-500">*</span></label>
                        <select required name="level" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
                            <option value="">Sélectionner un niveau...</option>
                            <option value="1">السابعة أساسي</option>
                            <option value="2">الثامنة أساسي</option>
                            <option value="3">التاسعة أساسي</option>
                        </select>
                    </div>
                    {/* Class Name  */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nom de la Classe<span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="name"
                            required
                            placeholder="Ex: 1"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                    {/* Code classe eduserv  */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Code de la Classe (Eduserv)</label>
                        <input
                            type="text"
                            name="codeclass"
                            placeholder="Ex: 1"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                    {/* Salle attitrée  */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Salle<span className="text-red-500">*</span></label>
                        <select
                            required
                            name="roomId"
                            disabled={isLoadingRooms}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-60"
                        >
                            <option value="">
                                {isLoadingRooms ? "Chargement des salles..." : "Sélectionner une salle..."}
                            </option>
                            {rooms.map((r) => (
                                <option key={r.id} value={r.id}>{isoler(r.name)}</option>
                            ))}
                        </select>
                        {!isLoadingRooms && rooms.length === 0 && (
                            <p className="text-xs text-amber-700">
                                Aucune salle disponible : toutes les salles sont déjà attribuées.{" "}
                                <Link href="/rooms" className="underline font-medium">Ajouter une salle</Link>
                            </p>
                        )}
                        <p className="text-xs text-slate-400">
                            Salle habituelle de la classe. Seules les salles libres sont proposées.
                        </p>
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
                        disabled={isLoading || isLoadingRooms}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                ...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Créer la Classe
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}