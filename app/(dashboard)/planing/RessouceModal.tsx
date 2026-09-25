"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect } from "react";
import { X, Upload, Loader2, FileIcon, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

interface RessouceModalProps {
    isOpen: boolean;
    onClose: () => void;
    planingId: number | null;
    classId: string;
    teacherId: string;
}

export default function RessouceModal({ isOpen, onClose, planingId, classId, teacherId }: RessouceModalProps) {
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClasse, setSelectedClasse] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingClasses, setIsLoadingClasses] = useState(false);

    useEffect(() => {
        if (isOpen && teacherId) {
            fetchClasses();
            setSelectedClasse(classId || "");
        }
    }, [isOpen, teacherId, classId]);

    const fetchClasses = async () => {
        setIsLoadingClasses(true);
        try {
            // Fetch classes for this teacher
            const res = await fetch(`/api/classes/teacher/${teacherId}`);
            if (res.ok) {
                const data = await res.json();
                setClasses(data);
            }
        } catch (error) {
            console.error("Failed to fetch classes", error);
            toast.error("Erreur lors du chargement des classes");
        } finally {
            setIsLoadingClasses(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!planingId) {
            toast.error("Veuillez d'abord enregistrer la séance");
            return;
        }
        if (files.length === 0) {
            toast.error("Veuillez sélectionner au moins un fichier");
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("planingId", planingId.toString());
            formData.append("classId", selectedClasse || ""); // Empty means all classes
            files.forEach(file => {
                formData.append("files", file);
            });

            const response = await fetch("/api/ressouces", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                toast.success("Ressources ajoutées !");
                setFiles([]);
                setSelectedClasse("");
                onClose();
            } else {
                const errorData = await response.json();
                toast.error(errorData.error || "Erreur lors de l'ajout");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erreur réseau");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                            <div>
                                <h3 className="text-xl font-bold">Ajouter des Ressources</h3>
                                <p className="text-indigo-100 text-sm">Fichiers pour cette séance</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Class Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Classe concernée</label>
                                <select
                                    value={selectedClasse}
                                    onChange={(e) => setSelectedClasse(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                                    disabled={isLoadingClasses}
                                >
                                    <option value="">Toutes les classes</option>
                                    {classes.map((c) => {
                                        const name = (c.level === "1") ? "السابعة أساسي " + c.name : (c.level === "2") ? "الثامنة أساسي " + c.name : (c.level === "3") ? "التاسعة أساسي " + c.name : ""
                                        return <option key={c.id} value={c.id}>{isoler(name)}</option>
                                    })}
                                </select>
                                {isLoadingClasses && <p className="text-[10px] text-indigo-600 animate-pulse">Chargement des classes...</p>}
                            </div>

                            {/* File Upload Area */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Fichiers</label>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center group-hover:border-indigo-500 group-hover:bg-indigo-50 transition-all">
                                        <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-3">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-700">Cliquez ou glissez vos fichiers ici</p>
                                        <p className="text-xs text-slate-500 mt-1">PDF, images, documents...</p>
                                    </div>
                                </div>
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {files.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group/item">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg text-slate-400">
                                                    <FileIcon className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
                                                    <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || files.length === 0}
                                    className="flex-[2] py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                        <>
                                            <Upload className="w-5 h-5" />
                                            Ajouter
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
