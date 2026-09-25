"use client";

import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, Trash2, Loader2, CalendarArrowDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [event, setevent] = useState<any>(null);

    useEffect(() => {
        const fetchevent = async () => {
            try {
                const res = await fetch(`/api/events/${unwrappedParams.id}`);
                if (res.ok) {
                    setevent(await res.json());
                }
            } catch (error) {
                console.error("Failed to fetch event", error);
            }
        };
        fetchevent();
    }, [unwrappedParams.id]);

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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get("name"),
            target: formData.get("type"),
            dateEvent: formData.get("dateEvent"),
            description: formData.get("description"),
        };

        try {
            const res = await fetch(`/api/events/${unwrappedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                router.push("/events");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to update event", error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer cette événementt ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/events/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/events");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to delete event", error);
            alert(messageException(error));
        } finally {
            setIsDeleting(false);
        }
    };

    if (!event) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/events"
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Modifier événement</h1>
                        <p className="text-slate-500 text-sm">Gérer les informations de l'événement.</p>
                    </div>
                </div>
                {!isReadOnly && <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Supprimer
                </button>}
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                    <CalendarArrowDown className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Détails de l'événement</h3>
                </div>

                <div className="space-y-4">
                    {/** Nom */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nom de l'Evénement<span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="name"
                            defaultValue={event.name}
                            readOnly={isReadOnly}
                            placeholder="Ex: Conseil de classe / Sortie ..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/** Cible */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Publique cible</label>
                            <select 
                            name="type" 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            defaultValue={event.target}
                            disabled={isReadOnly}>
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
                                readOnly={isReadOnly}
                                defaultValue={event.dateEvent ? new Date(event.dateEvent).toISOString().split('T')[0] : ''}
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
                                    defaultValue={event.description}
                                    readOnly={isReadOnly}
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
                    {!isReadOnly && <button
                        type="submit"
                        disabled={isLoading}
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
                                Mettre à jour
                            </>
                        )}
                    </button>}
                </div>
            </form>
        </div>
    );
}
