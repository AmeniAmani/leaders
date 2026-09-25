"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect } from "react";
import { Search, Plus, Filter, Eye, Trash2, Loader2, BookOpen, Save, LibraryBig, Calendar, Clock, ChevronRight, Edit3, Trash, Paperclip } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { messageErreur, messageException } from "@/lib/erreur-api";
import RessouceModal from "./RessouceModal";

export default function PlaningPage() {
    const [planings, setPlanings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState("");
    const [teachers, setTeachers] = useState<any[]>([]);
    const [anneeScolaires, setAnneeScolaires] = useState<string[]>([]);
    const [selectedAS, setSelectedAS] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        return now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
    });
    const [selectedClassId, setSelectedClassId] = useState("");
    const [classes, setClasses] = useState<any[]>([]);
    const [isRessourceModalOpen, setIsRessourceModalOpen] = useState(false);
    const [activePlaningForModal, setActivePlaningForModal] = useState<any>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        type: "",
        description: "",
        datePlaning: new Date().toISOString().split('T')[0],
        teacherId: "",
        name: "",
        classId: ""
    });

    const getCookie = (name: string) => {
        if (typeof document === "undefined") return null;
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] ?? null;
    };

    const userRole = getCookie("user-role");
    const userId = getCookie("user-id");

    useEffect(() => {
        const init = async () => {
            await fetchTeachers();
            if (userRole !== 'admin') {
                await fetchPlanings();
            } else {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (selectedTeacher) {
            fetchClasses(selectedTeacher);
        } else {
            setClasses([]);
            setSelectedClassId("");
        }
    }, [selectedTeacher]);

    useEffect(() => {
        if (selectedTeacher) {
            fetchPlanings();
        }
    }, [selectedTeacher, selectedAS, selectedClassId]);

    const fetchClasses = async (tid: string) => {
        try {
            const res = await fetch(`/api/classes/teacher/${tid}`);
            if (res.ok) {
                const data = await res.json();
                setClasses(data);
                if (data.length > 0) {
                    setSelectedClassId(prev => {
                        const exists = data.find((c: any) => c.id.toString() === prev);
                        return exists ? prev : data[0].id.toString();
                    });
                } else {
                    setSelectedClassId("");
                }
            }
        } catch (error) {
            console.error("Failed to fetch classes", error);
        }
    };

    const fetchTeachers = async () => {
        try {
            const isTeacher = userRole !== 'admin';
            const res = await fetch(isTeacher ? `/api/teachers/${userId}` : '/api/teachers');
            if (res.ok) {
                const data = await res.json();
                const list = isTeacher ? [data] : data;
                setTeachers(list);
                if (isTeacher) {
                    setSelectedTeacher(userId || "");
                }
            }
        } catch (error) {
            console.error("Failed to fetch teachers", error);
            toast.error("Erreur lors du chargement des enseignants");
        }
    };

    const fetchPlanings = async () => {
        setIsLoading(true);
        try {
            const isTeacher = userRole !== 'admin';
            const targetTeacherId = isTeacher ? userId : selectedTeacher;

            if (!targetTeacherId && userRole === 'admin') {
                setPlanings([]);
                setIsLoading(false);
                return;
            }

            const classQuery = selectedClassId ? `&classId=${selectedClassId}` : "";
            const url = isTeacher
                ? `/api/planings/teacher/${userId}?as=${selectedAS}${classQuery}`
                : `/api/planings/teacher/${targetTeacherId}?as=${selectedAS}${classQuery}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setPlanings(data);

                // Update anneeScolaires dropdown options if needed (optional)
                const yearsInDB = Array.from(new Set(data.map((e: any) => e?.as))).filter(Boolean) as string[];
                const currentYear = (() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    return now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
                })();
                const allYears = Array.from(new Set([currentYear, ...yearsInDB])).sort((a, b) => b.localeCompare(a));
                setAnneeScolaires(allYears);
            }
        } catch (error) {
            console.error("Failed to fetch planings", error);
            toast.error("Erreur lors du chargement des répartitions");
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const targetTeacherId = userRole === 'admin' ? selectedTeacher : userId;
        if (!targetTeacherId) {
            toast.error("Veuillez sélectionner un enseignant");
            return;
        }

        if (!selectedClassId) {
            toast.error("Veuillez sélectionner une classe");
            return;
        }

        setIsSubmitting(true);
        try {
            const method = editingId ? 'PUT' : 'POST';
            const url = editingId ? `/api/planings/${editingId}` : '/api/planings';

            const payload = {
                ...formData,
                as: selectedAS,
                classId: selectedClassId,
                teacherId: targetTeacherId
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                toast.success(editingId ? "Répartition modifiée !" : "Répartition ajoutée !");
                setFormData({
                    type: "",
                    description: "",
                    datePlaning: new Date().toISOString().split('T')[0],
                    teacherId: "", // Not used directly in header-fix mode but kept for schema
                    name: "",
                    classId: ""
                });
                setEditingId(null);
                fetchPlanings();
            } else {
                toast.error(await messageErreur(response));
            }
        } catch (error) {
            console.error(error);
            toast.error(messageException(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (planing: any) => {
        setEditingId(planing.id);
        setSelectedClassId(planing.classId?.toString() || "");
        setSelectedAS(planing.as || "");
        setFormData({
            type: planing.type || "",
            description: planing.description || "",
            datePlaning: planing.datePlaning ? new Date(planing.datePlaning).toISOString().split('T')[0] : "",
            teacherId: planing.teacherId?.toString() || "",
            name: planing.name || "",
            classId: planing.classId?.toString() || ""
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Voulez-vous supprimer cette répartition ?")) return;

        try {
            const response = await fetch(`/api/planings/${id}`, { method: 'DELETE' });
            if (response.ok) {
                toast.success("Supprimé avec succès");
                setPlanings(planings.filter(p => p.id !== id));
            } else {
                toast.error("Erreur lors de la suppression");
            }
        } catch (error) {
            toast.error("Erreur réseau");
        }
    };

    const handleDeleteRessouce = async (planingId: number, ressouceId: number) => {
        if (!confirm("Voulez-vous supprimer cette ressource ?")) return;

        try {
            const response = await fetch(`/api/ressouces/${ressouceId}`, { method: 'DELETE' });
            if (response.ok) {
                toast.success("Ressource supprimée");
                setPlanings(planings.map(p => {
                    if (p.id === planingId) {
                        return {
                            ...p,
                            ressouces: p.ressouces.filter((r: any) => r.id !== ressouceId)
                        };
                    }
                    return p;
                }));
            } else {
                toast.error("Erreur lors de la suppression");
            }
        } catch (error) {
            toast.error("Erreur réseau");
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                    <p className="text-slate-500 font-medium">Chargement de votre planification...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20">
            <Toaster position="top-right" />

            {/* Header with Glassmorphism Effect */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-indigo-500 p-8 text-white shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
            >
                {/** Titre */}
                <div className="relative z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight">Répartition Annuelle</h1>
                    <p className="mt-2 text-indigo-100 text-lg opacity-90">Organisez vos chapitres et contenus pour l'année scolaire.</p>
                </div>
                {/** Informations Planing */}
                <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    {/** Enseignant */}
                    {userRole === 'admin' && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Enseignant</label>
                            <select
                                value={selectedTeacher}
                                onChange={(e) => setSelectedTeacher(e.target.value)}
                                className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm font-medium min-w-[180px]"
                            >
                                <option value="" className="text-slate-900">Sélectionner...</option>
                                {teachers.map((t) => (
                                    <option key={t.id} value={t.id} className="text-slate-900">{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {/** Année Scolaire */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Année Scolaire</label>
                        <select
                            value={selectedAS}
                            onChange={(e) => setSelectedAS(e.target.value)}
                            className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm font-medium min-w-[120px]"
                        >
                            {anneeScolaires.map((as) => (
                                <option key={as} value={as} className="text-slate-900">{as}</option>
                            ))}
                        </select>
                    </div>
                    {/** Classe */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold opacity-70 ml-1">Classe<span className="text-red-500">*</span></label>
                        <select
                            required
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm font-medium min-w-[150px]"
                        >
                            <option value="" className="text-slate-900">Choisir une classe</option>
                            {classes.map((c) => {
                                const name = (c.level === "1") ? "السابعة أساسي " + c.name : (c.level === "2") ? "الثامنة أساسي " + c.name : (c.level === "3") ? "التاسعة أساسي " + c.name : c.name;
                                return <option key={c.id} value={c.id.toString()} className="text-slate-900">{isoler(name)}</option>;
                            })}
                        </select>
                    </div>
                </div>
                {/** Informations Ressouces */}


                {/* Decorative elements */}
                <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl"></div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-1"
                >
                    <div className="sticky top-8 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                <Plus className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingId ? "Modifier la séance" : "Nouvelle séance"}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Chapitre / Section<span className="text-red-500">*</span></label>
                                <select
                                    name="type"
                                    required
                                    value={formData.type}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner...</option>
                                    <option value="1">Chapitre</option>
                                    <option value="2">Section</option>
                                    <option value="3">Sous-section</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Nom<span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    placeholder="Ex: Chapitre 1, Trimestre 1..."
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Date Prévue<span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    name="datePlaning"
                                    required
                                    value={formData.datePlaning}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Contenu</label>
                                <textarea
                                    name="description"
                                    rows={4}
                                    placeholder="Détails du contenu à enseigner..."
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingId(null);
                                            setFormData({
                                                type: "",
                                                description: "",
                                                datePlaning: new Date().toISOString().split('T')[0],
                                                teacherId: userRole === 'admin' ? "" : (userId || ""),
                                                name: "",
                                                classId: ""
                                            });
                                        }}
                                        className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
                                    >
                                        Annuler
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            {editingId ? "Mettre à jour" : "Enregistrer"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>

                {/* List Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                            <BookOpen className="w-6 h-6 text-indigo-500" />
                            Répartitions Enregistrées
                        </h2>
                        {/** 
                        <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-full">
                            {planings.length} séance{planings.length > 1 ? 's' : ''}
                        </span>*/}
                    </div>

                    <AnimatePresence mode="popLayout">
                        {planings.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center flex flex-col items-center gap-4"
                            >
                                <div className="p-4 bg-white rounded-full shadow-sm text-slate-300">
                                    <LibraryBig className="w-12 h-12" />
                                </div>
                                <p className="text-slate-500 font-medium max-w-xs">
                                    Aucune répartition n'a encore été créée. Commencez par en ajouter une !
                                </p>
                            </motion.div>
                        ) : (
                            <div className="space-y-4">
                                {planings.map((planing, index) => {
                                    const indentation = planing.type === "2" ? "ml-8" : planing.type === "3" ? "ml-16" : "";
                                    const typeLabel = planing.type === "1" ? "Chapitre" : planing.type === "2" ? "Section" : planing.type === "3" ? "Sous-section" : planing.type;
                                    const typeColor = planing.type === "1" ? "text-indigo-600 bg-indigo-50" : planing.type === "2" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50";

                                    return (
                                        <motion.div
                                            key={planing.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`group bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 relative overflow-hidden ${indentation}`}
                                        >
                                            <div className="flex gap-6 items-start">
                                                {/* Date Badge */}
                                                <div className="flex-shrink-0 w-20 h-20 bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                                                    <span className="text-xs uppercase tracking-wider opacity-60">
                                                        {new Date(planing.datePlaning).toLocaleDateString('fr-FR', { month: 'short' })}
                                                    </span>
                                                    <span className="text-2xl">
                                                        {new Date(planing.datePlaning).getDate()}
                                                    </span>
                                                </div>

                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase ${typeColor}`}>
                                                                {typeLabel}
                                                            </span>
                                                            {planing.averageNote !== null && planing.averageNote !== undefined && (
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${
                                                                    planing.averageNote >= 5 
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                                        : 'bg-red-50 text-red-700 border-red-100'
                                                                }`}>
                                                                    ⭐ {planing.averageNote.toFixed(2)} / 10 ({planing.evalCount})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setActivePlaningForModal(planing);
                                                                    setIsRessourceModalOpen(true);
                                                                }}
                                                                className="p-2 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
                                                                title="Ajouter des ressources"
                                                            >
                                                                <Paperclip className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleEdit(planing)}
                                                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(planing.id)}
                                                                className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                                                        {planing.name}
                                                    </h3>

                                                    <p className="text-slate-500 text-sm whitespace-pre-wrap line-clamp-2">
                                                        {planing.description}
                                                    </p>

                                                    {/* Resources Section */}
                                                    <div className="mt-4 pt-4 border-t border-slate-50">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                            <Paperclip className="w-3 h-3" />
                                                            Ressources
                                                        </h4>
                                                        {planing.ressouces && planing.ressouces.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {planing.ressouces.map((res: any, idx: number) => (
                                                                    <div key={res.id} className="group/res flex items-center gap-1">
                                                                        <a
                                                                            href={res.name}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-xl text-xs font-medium text-slate-600 hover:text-indigo-600 transition-all"
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                            Consulter {planing.ressouces.length > 1 ? idx + 1 : ""}
                                                                        </a>
                                                                        <button
                                                                            onClick={() => handleDeleteRessouce(planing.id, res.id)}
                                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                            title="Supprimer la ressource"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic">Pas de ressources</p>
                                                        )}
                                                    </div>
                                                    {/* Teacher and AS 
                                                    <div className="flex items-center gap-4 pt-2 text-xs font-medium text-slate-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {planing.as}
                                                        </div>
                                                        {userRole === 'admin' && (
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-4 h-4 rounded-full bg-slate-200"></div>
                                                                {planing.teacher?.name}
                                                            </div>
                                                        )}
                                                    </div>*/}
                                                </div>
                                            </div>

                                            {/* Hover decoration */}
                                            <div className="absolute top-0 right-0 h-1 w-0 bg-indigo-500 group-hover:w-full transition-all duration-500"></div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <RessouceModal
                isOpen={isRessourceModalOpen}
                onClose={() => {
                    setIsRessourceModalOpen(false);
                    setActivePlaningForModal(null);
                    fetchPlanings();
                }}
                planingId={activePlaningForModal?.id || null}
                classId={activePlaningForModal?.classId?.toString() || selectedClassId}
                teacherId={activePlaningForModal?.teacherId?.toString() || (userRole === 'admin' ? selectedTeacher : (userId || ""))}
            />
        </div>
    );
}


