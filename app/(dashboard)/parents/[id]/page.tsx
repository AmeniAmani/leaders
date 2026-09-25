"use client";

import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, User, Mail, Phone, MapPin, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

export default function ParentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [parent, setParent] = useState<any>(null);

    useEffect(() => {
        const fetchParent = async () => {
            try {
                const res = await fetch(`/api/parents/${unwrappedParams.id}`);
                if (res.ok) {
                    setParent(await res.json());
                }
            } catch (error) {
                console.error("Failed to fetch parent", error);
            }
        };
        fetchParent();
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
            name1: formData.get("name1"),
            email1: formData.get("email1"),
            phone1: formData.get("phone1"),
            relation1: formData.get("relation1"),
            name2: formData.get("name2"),
            email2: formData.get("email2"),
            phone2: formData.get("phone2"),
            relation2: formData.get("relation2"),
            // Only send password if provided
            username: formData.get("username"),
            password: formData.get("password") || undefined,
            confirmPassword: formData.get("confirmPassword") || undefined,
            active: formData.get("active") === "on"
        };
        if (data.relation1 === data.relation2) {
            alert("Les relations doivent être différentes.");
            setIsLoading(false);
            return;
        }
        if (data.password !== data.confirmPassword) {
            alert("Les mots de passe ne correspondent pas.");
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch(`/api/parents/${unwrappedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                router.push("/parents");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to update parent", error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer ce parent ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/parents/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/parents");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to delete parent", error);
            alert(messageException(error));
        } finally {
            setIsDeleting(false);
        }
    };

    if (!parent) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
        </div>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href={isReadOnly ? "/students" : "/parents"}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Modifier Parent</h1>
                        <p className="text-slate-500 text-sm">ID: {parent.id}</p>
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
                <div className="lg:col-span-2 space-y-6">
                    {/**Informations Tuteur 1 */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5 text-pink-500" />
                            Informations Tuteur 1
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nom Complet<span className="text-red-500">*</span></label>
                                <input
                                    name="name1"
                                    type="text"
                                    defaultValue={parent.name1}
                                    required
                                    readOnly={isReadOnly}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Relation</label>
                                <select
                                    name="relation1"
                                    defaultValue={parent.relation1}
                                    disabled={isReadOnly}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm">
                                    <option value="father">Père</option>
                                    <option value="mother">Mère</option>
                                    <option value="guardian">Tuteur Légal</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        name="email1"
                                        type="email"
                                        defaultValue={parent.email1}
                                        readOnly={isReadOnly}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Téléphone<span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        name="phone1"
                                        type="tel"
                                        required
                                        defaultValue={parent.phone1}
                                        readOnly={isReadOnly}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/**Informations Tuteur 2 */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5 text-pink-500" />
                            Informations Tuteur 2
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nom Complet</label>
                                <input
                                    name="name2"
                                    type="text"
                                    defaultValue={parent.name2}
                                    readOnly={isReadOnly}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Relation</label>
                                <select
                                    name="relation2"
                                    defaultValue={parent.relation2}
                                    disabled={isReadOnly}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm">
                                    <option value="mother">Mère</option>
                                    <option value="father">Père</option>
                                    <option value="guardian">Tuteur Légal</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        name="email2"
                                        type="email"
                                        defaultValue={parent.email2}
                                        readOnly={isReadOnly}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Téléphone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        name="phone2"
                                        type="tel"
                                        defaultValue={parent.phone2}
                                        readOnly={isReadOnly}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/**Informations de compte */}
                    {!isReadOnly && <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-500" />
                                INFORMATION DE COMPTE
                            </h3>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-slate-700">Statut du compte</label>
                                    <p className="text-xs text-slate-500">Désactiver pour bloquer l'accès à l'application mobile</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="active" defaultChecked={parent.active !== false} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none ring-0 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nom d'utilisateur<span className="text-red-500">*</span></label>
                                <input
                                    name="username"
                                    type="text"
                                    required
                                    defaultValue={parent.username}
                                    readOnly={isReadOnly}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                                    <input
                                        name="password"
                                        type="password"
                                        readOnly={isReadOnly}
                                        placeholder="Laisser vide pour ne pas changer"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Retaper le mot de passe</label>
                                    <input
                                        name="confirmPassword"
                                        type="password"
                                        readOnly={isReadOnly}
                                        placeholder="Laisser vide pour ne pas changer"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>}
                </div>

                {!isReadOnly && <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
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
                        className="px-6 py-2.5 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 shadow-lg shadow-pink-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                ...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Mettre à jour
                            </>
                        )}
                    </button>
                </div>}
            </form>
        </div>
    );
}
