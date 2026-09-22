"use client";

import { useState } from "react";
import { Save, User, Mail, Phone, MapPin } from "lucide-react";

interface ParentFormProps {
    onSuccess?: (parent: { id: number; name: string }) => void;
    onCancel?: () => void;
}

export default function ParentForm({ onSuccess, onCancel }: ParentFormProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(formData.entries());
        data.active = formData.get("active") === "on";

        // Tuteur 1 : les trois champs sont obligatoires
        const name1 = String(data.name1 || "").trim();
        const relation1 = String(data.relation1 || "").trim();
        const phone1 = String(data.phone1 || "").trim();

        if (!name1) { alert("Le nom complet du tuteur 1 est obligatoire."); return; }
        if (!relation1) { alert("Indiquez la relation du tuteur 1 avec l'élève."); return; }
        if (!phone1) { alert("Le téléphone du tuteur 1 est obligatoire."); return; }

        // La relation du tuteur 2 ne se compare que s'il est renseigné
        const name2 = String(data.name2 || "").trim();
        if (name2 && data.relation1 === data.relation2) {
            alert("Les deux tuteurs ne peuvent pas avoir la même relation avec l'élève.");
            return;
        }

        if (data.password !== data.confirmPassword) {
            alert("Les mots de passe ne correspondent pas.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch("/api/parents", {
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

            const newParent = await res.json();

            if (onSuccess) {
                onSuccess(newParent);
            }
        } catch (error: any) {
            console.error(error);
            alert(error?.message || "Une erreur est survenue lors de la création.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-6">
                {/** Information Tuteur 1 */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <User className="w-5 h-5 text-pink-500" />
                            Informations Tuteur 1
                        </h3>
                        <span className="text-xs font-bold text-pink-700 bg-pink-50 border border-pink-200 px-2.5 py-1 rounded-lg">
                            Contact principal
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                                Nom Complet<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name1"
                                required
                                placeholder="Ex: Ahmed Konzani"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                                Relation<span className="text-red-500">*</span>
                            </label>
                            <select
                                name="relation1"
                                required
                                defaultValue=""
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                            >
                                <option value="">Sélectionner...</option>
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
                                    type="email"
                                    name="email1"
                                    placeholder="parent@email.com"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                                Téléphone<span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="tel"
                                    name="phone1"
                                    required
                                    placeholder="+216 00 000 000"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-slate-400 mt-4">
                        C&apos;est ce contact que l&apos;établissement appellera en priorité.
                    </p>
                </div>
                {/** Information Tuteur 2 */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <User className="w-5 h-5 text-slate-400" />
                            Informations Tuteur 2
                        </h3>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            Facultatif
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Nom Complet</label>
                            <input
                                type="text"
                                name="name2"
                                placeholder="Ex: Ahmed Konzani"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Relation</label>
                            <select name="relation2" defaultValue="" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm">
                                <option value="">Sélectionner...</option>
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
                                    type="email"
                                    name="email2"
                                    placeholder="parent@email.com"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Téléphone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="tel"
                                    name="phone2"
                                    placeholder="+216 00 000 000"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                {/** Information de compte */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" />
                        INFORMATION DE COMPTE
                    </h3>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium text-slate-700">Statut du compte</label>
                                <p className="text-xs text-slate-500">Désactiver pour bloquer l&apos;accès à l&apos;application mobile</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="active" defaultChecked className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none ring-0 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                            </label>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Nom d&apos;utilisateur<span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="username"
                                required
                                autoComplete="off"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Mot de passe<span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    autoComplete="new-password"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Confirmation<span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    required
                                    autoComplete="new-password"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <p className="mr-auto text-xs text-slate-400">
                    Les champs marqués d&apos;un <span className="text-red-500">*</span> sont obligatoires.
                </p>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Annuler
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2.5 rounded-xl bg-pink-600 text-white font-medium hover:bg-pink-700 shadow-lg shadow-pink-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                    {isLoading ? "..." : (
                        <>
                            <Save className="w-5 h-5" />
                            Enregistrer le Parent
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}