"use client";

import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, MapPin, Users, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

export default function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [room, setRoom] = useState<any>(null);

    useEffect(() => {
        const fetchRoom = async () => {
            try {
                const res = await fetch(`/api/rooms/${unwrappedParams.id}`);
                if (res.ok) {
                    setRoom(await res.json());
                }
            } catch (error) {
                console.error("Failed to fetch room", error);
            }
        };
        fetchRoom();
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
            type: formData.get("type"),
            capacity: Number(formData.get("capacity")),
            status: formData.get("status")
        };

        try {
            const res = await fetch(`/api/rooms/${unwrappedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                router.push("/rooms");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to update room", error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer cette salle ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/rooms/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/rooms");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to delete room", error);
            alert(messageException(error));
        } finally {
            setIsDeleting(false);
        }
    };

    if (!room) {
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
                        href="/rooms"
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Modifier Salle</h1>
                        <p className="text-slate-500 text-sm">Gérer les informations de la salle.</p>
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
                    <MapPin className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Détails de la Salle</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nom de la Salle<span className="text-red-500">*</span></label>
                        <input
                            name="name"
                            required
                            type="text"
                            defaultValue={room.name}
                            readOnly={isReadOnly}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Type</label>
                            <select 
                                name="type" 
                                defaultValue={room.type}
                                disabled={isReadOnly} 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
                                <option value="Classroom">Salle de Classe</option>
                                <option value="Laboratory">Laboratoire</option>
                                <option value="Amphitheater">Amphithéâtre</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Capacité</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    name="capacity"
                                    type="number"
                                    min="1"
                                    defaultValue={room.capacity}
                                    readOnly={isReadOnly}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Statut</label>
                        <select name="status" defaultValue={room.status}
                             disabled={isReadOnly}
                             className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
                            <option value="Available">Disponible</option>
                            <option value="Maintenance">Maintenance</option>
                        </select>
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
