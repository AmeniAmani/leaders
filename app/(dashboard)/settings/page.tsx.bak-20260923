"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Save, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface User {
    login: string;
    role: string;
    active: boolean;
    // Password is handled separately for updates
}

export default function SettingsPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        login: "",
        password: "",
        role: "admin",
        active: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (!res.ok) throw new Error("Failed to fetch users");
            const data = await res.json();
            setUsers(data);
        } catch (err) {
            setError("Erreur lors du chargement des utilisateurs.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (mode: "create" | "edit", user?: User) => {
        setModalMode(mode);
        if (mode === "edit" && user) {
            setSelectedUser(user);
            setFormData({ login: user.login, password: "", role: user.role || "admin", active: user.active }); // Don't pre-fill password
        } else {
            setSelectedUser(null);
            setFormData({ login: "", password: "", role: "admin", active: true });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData({ login: "", password: "", role: "admin", active: true });
        setSelectedUser(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            if (modalMode === "create") {
                const res = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error("Failed to create user");
            } else {
                // Edit
                const res = await fetch(`/api/users/${selectedUser?.login}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error("Failed to update user");
            }
            await fetchUsers();
            handleCloseModal();
        } catch (err) {
            console.error(err);
            setError("Une erreur est survenue.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (login: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;

        try {
            const res = await fetch(`/api/users/${login}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete user");
            await fetchUsers();
        } catch (err) {
            console.error(err);
            setError("Erreur lors de la suppression.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestion des Utilisateurs</h1>
                    <p className="text-slate-500">Ajoutez, modifiez ou supprimez des comptes utilisateurs.</p>
                </div>
                <button
                    onClick={() => handleOpenModal("create")}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Nouvel Utilisateur
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 border border-red-200">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-900">Identifiant</th>
                                <th className="px-6 py-4 font-semibold text-slate-900">Rôle</th>
                                {/*<th className="px-6 py-4 font-semibold text-slate-900">Actif</th>*/}
                                <th className="px-6 py-4 font-semibold text-slate-900 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Chargement...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                        Aucun utilisateur trouvé.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.login} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{user.login}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-xs font-semibold border",
                                                user.role === "admin"
                                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            )}>
                                                {user.role}
                                            </span>
                                        </td>
                                        {/*<td className="px-6 py-4 font-medium text-slate-900">{user.active ? "Oui" : "Non"}</td>*/}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal("edit", user)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.login)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                            onClick={handleCloseModal}
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white w-full max-w-md rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
                            >
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <h2 className="text-lg font-bold text-slate-900">
                                        {modalMode === "create" ? "Nouvel Utilisateur" : "Modifier Utilisateur"}
                                    </h2>
                                    <button
                                        onClick={handleCloseModal}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Identifiant</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                value={formData.login}
                                                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                                                disabled={modalMode === "edit"} // Prevent changing ID on edit
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                                placeholder="ex: admin"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            {modalMode === "edit" ? "Nouveau Mot de passe (laisser vide pour conserver)" : "Mot de passe"}
                                        </label>
                                        <input
                                            type="text" // Visible for admin convenience, change to password if preferred
                                            required={modalMode === "create"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Rôle</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="prof">Enseignant</option>
                                        </select>
                                    </div>
                                    {/*
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Actif</label>
                                        <input type="checkbox"
                                            checked={formData.active}
                                            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                            className="m-5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                                        />

                                    </div>
                                    */}
                                    <div className="pt-4 flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {modalMode === "create" ? "Créer" : "Enregistrer"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
