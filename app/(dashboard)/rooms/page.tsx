"use client";

import { useState, useEffect } from "react";
import { Search, Plus, MapPin, Users, MoreVertical, LayoutGrid, List as ListIcon, Loader2, Eye, Clapperboard } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const getCookie = (name: string) => {
    if (typeof document === "undefined") return null;

    return document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="))
        ?.split("=")[1] ?? null;
};

export default function RoomsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [rooms, setRooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            // Enseignant : seulement les salles de ses classes
            const userId = getCookie("user-id");
            const url = getCookie("user-role") !== 'admin' && userId ? `/api/rooms?teacherId=${userId}` : '/api/rooms';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setRooms(data);
            }
        } catch (error) {
            console.error("Failed to fetch rooms", error);
        } finally {
            setIsLoading(false);
        }
    };

    const [role, setRole] = useState('');

    useEffect(() => {
            setRole(getCookie("user-role") ?? "N/A");
        }, []);
    let isReadOnly = role !== 'admin';

    // Administration : demandes de réservation de la salle de cinéma en attente
    const [demandesEnAttente, setDemandesEnAttente] = useState(0);
    useEffect(() => {
        if (role !== 'admin') return;
        fetch('/api/reservations', { cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then(d => setDemandesEnAttente(d?.enAttente || 0))
            .catch(() => setDemandesEnAttente(0));
    }, [role]);

    const filteredRooms = rooms.filter(room =>
        (room.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Available": return "bg-emerald-100 text-emerald-700";
            case "Occupied": return "bg-rose-100 text-rose-700";
            case "Maintenance": return "bg-amber-100 text-amber-700";
            default: return "bg-slate-100 text-slate-700";
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Salles</h1>
                    <p className="text-slate-500 mt-1">Gestion des salles de classe et laboratoires.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {role === 'prof' && <Link href="/rooms/cinema" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
                        <Clapperboard className="w-5 h-5" />
                        Réserver la salle de cinéma
                    </Link>}
                    {role === 'admin' && <Link href="/rooms/reservations" className="relative bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition-all active:scale-95">
                        <Clapperboard className="w-5 h-5 text-indigo-500" />
                        Réserver salle
                        {demandesEnAttente > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center" title="Demandes en attente">
                                {demandesEnAttente}
                            </span>
                        )}
                    </Link>}
                    {!isReadOnly && <Link href="/rooms/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
                        <Plus className="w-5 h-5" />
                        Nouvelle Salle
                    </Link>}
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Rechercher une salle..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/** */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        <ListIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {isReadOnly && rooms.length === 0 && (
                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-500">
                    Aucune salle liée à vos classes.
                </div>
            )}

            {/* Content */}
            {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredRooms.map((room, index) => (
                        <motion.div
                            key={room.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-lg hover:border-indigo-100 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${getStatusColor(room.status)}`}>
                                    {room.status === "Available" ? "Dispo" : room.status === "Occupied" ? "Occupée" : "Maintenance"}
                                </div>
                            </div>

                            <Link href={`/rooms/${room.id}`} className="block">
                                <h3 className="text-xl font-bold text-slate-900 mb-1 hover:text-indigo-600 transition-colors">{room.name}</h3>
                            </Link>
                            <p className="text-slate-500 text-sm mb-4">{room.type === "Classroom" ? "Salle de Classe" : room.type === "Laboratory" ? "Laboratoire" : "Amphithéâtre"}</p>

                            <div className="flex items-center gap-2 text-slate-500 text-sm bg-slate-50 p-2 rounded-lg justify-center">
                                <Users className="w-4 h-4" />
                                <span>Capacité: <b>{room.capacity}</b></span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">Nom</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Type</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Capacité</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Statut</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRooms.map((room) => (
                                <tr key={room.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <Link href={`/rooms/${room.id}`} className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                                            {room.name}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{room.type === "Classroom" ? "Salle de Classe" : room.type === "Laboratory" ? "Laboratoire" : "Amphithéâtre"}</td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-slate-400" />
                                            {room.capacity}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${getStatusColor(room.status)}`}>
                                            {room.status === "Available" ? "Dispo" : room.status === "Occupied" ? "Occupée" : "Maintenance"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/rooms/${room.id}`} className="text-slate-500 hover:text-indigo-600 transition-colors">
                                                <Eye className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
