"use client";

import { isoler } from "@/lib/bidi";
import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, School, Trash2, User, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";
import { motion } from "framer-motion";

export default function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [classe, setClasse] = useState<any>(null);

    // Salles disponibles + salle sélectionnée (champ contrôlé)
    const [rooms, setRooms] = useState<any[]>([]);
    const [roomId, setRoomId] = useState<string>("");

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [classRes, roomsRes, classesRes] = await Promise.all([
                    fetch(`/api/classes/${unwrappedParams.id}`),
                    fetch(`/api/rooms`),
                    fetch(`/api/classes`),
                ]);

                if (classRes.ok) {
                    const current = await classRes.json();
                    setClasse(current);
                    setRoomId(current?.roomId ? String(current.roomId) : "");
                }

                if (roomsRes.ok && classesRes.ok) {
                    const allRooms = await roomsRes.json();
                    const allClasses = await classesRes.json();

                    // Salles déjà prises par une AUTRE classe
                    const takenIds = new Set(
                        allClasses
                            .filter((c: any) => c.id !== Number(unwrappedParams.id))
                            .map((c: any) => c.roomId)
                            .filter(Boolean)
                    );
                    setRooms(allRooms.filter((r: any) => !takenIds.has(r.id)));
                }
            } catch (error) {
                console.error("Failed to fetch class", error);
            }
        };
        fetchAll();
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
            level: formData.get("level"),
            codeclass: formData.get("codeclass"),
            roomId: roomId,
        };

        try {
            const res = await fetch(`/api/classes/${unwrappedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                router.push("/classes");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to update class", error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer cette classe ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/classes/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/classes");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to delete class", error);
            alert(messageException(error));
        } finally {
            setIsDeleting(false);
        }
    };

    if (!classe) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const classStudents = classe.students || [];

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/classes"
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Détails Classe: {classe.name}</h1>
                        <p className="text-slate-500 text-sm">Gérez les détails et voyez la liste des élèves.</p>
                    </div>
                </div>
                {!isReadOnly && <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Supprimer la classe
                </button>}
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                    <School className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Détails de la Classe</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Niveau<span className="text-red-500">*</span></label>
                        <select
                            name="level"
                            required
                            defaultValue={classe.level}
                            disabled={isReadOnly}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        >
                            <option value="1">السابعة أساسي</option>
                            <option value="2">الثامنة أساسي</option>
                            <option value="3">التاسعة أساسي</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nom de la Classe<span className="text-red-500">*</span></label>
                        <input
                            name="name"
                            type="text"
                            required
                            defaultValue={classe.name}
                            readOnly={isReadOnly}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Code de la Classe (Eduserv)</label>
                        <input
                            name="codeclass"
                            type="text"
                            defaultValue={classe.codeclass ?? ""}
                            readOnly={isReadOnly}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                    {/* Salle attitrée de la classe */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Salle<span className="text-red-500">*</span></label>
                        <select
                            required
                            name="roomId"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            disabled={isReadOnly}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-60"
                        >
                            <option value="">Sélectionner une salle...</option>
                            {rooms.map((r) => (
                                <option key={r.id} value={r.id}>{isoler(r.name)}</option>
                            ))}
                        </select>
                        {!roomId && (
                            <p className="text-xs text-amber-700 font-medium">
                                Cette classe n&apos;a pas encore de salle attribuée.
                            </p>
                        )}
                        <p className="text-xs text-slate-400">
                            Seules les salles libres sont proposées.
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
                                Mettre à jour la classe
                            </>
                        )}
                    </button>
                    }
                </div>
            </form>

            {/* Students List Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <User className="w-5 h-5" />
                        <h3 className="font-bold text-lg text-slate-900">Liste des Élèves ({classStudents.length})</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Élève</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider text-center">Genre</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Identifiant</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {classStudents.map((student: any, index: number) => (
                                <motion.tr
                                    key={student.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="hover:bg-slate-50/80 transition-colors group"
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={`../${student.photo}` || "/avatars/student-1.png"}
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + student.firstName + '+' + student.lastName }}
                                                    alt={student.firstName} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="font-bold text-slate-700">{student.firstName} {student.lastName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${student.gender === 'm' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-pink-50 text-pink-600 border border-pink-100'
                                            }`}>
                                            {student.gender === 'm' ? 'Masculin' : 'Féminin'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-sm font-mono text-slate-500">{student.idenelev}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Link href={`/students/${student.id}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-sm font-medium">
                                            <Eye className="w-3.5 h-3.5" />
                                            Profil
                                        </Link>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {classStudents.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Aucun élève dans cette classe.</p>
                    </div>
                )}
            </div>
        </div>
    );
}