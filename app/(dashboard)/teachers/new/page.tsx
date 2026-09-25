"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect } from "react";
import { ChevronLeft, Save, Upload, User, Mail, Phone, BookOpen, GraduationCap, School, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Subject {
    id: number;
    name: string;
}

interface ClassTeacher {
    id: number;
    name: string | null;
    subjectId: number | null;
}

interface ClassItem {
    id: number;
    name: string | null;
    level: string | null;
    teachers: ClassTeacher[];
}

// Libellé arabe d'une classe (même logique que le reste de l'application)
const classLabel = (c: { level: string | null; name: string | null }) => {
    const prefix =
        c.level === "1" ? "السابعة أساسي " :
        c.level === "2" ? "الثامنة أساسي " :
        c.level === "3" ? "التاسعة أساسي " : "";
    return prefix + (c.name || "");
};

export default function NewTeacherPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);

    // Matière et classes sélectionnées
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
    const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);

    // Sélection des classes dans une fenêtre dédiée
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [draftClassIds, setDraftClassIds] = useState<number[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [subjectsRes, classesRes] = await Promise.all([
                    fetch("/api/subjects"),
                    fetch("/api/classes"),
                ]);
                if (subjectsRes.ok) setSubjects(await subjectsRes.json());
                if (classesRes.ok) setClasses(await classesRes.json());
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    // Enseignant de la même matière déjà rattaché à cette classe, s'il existe
    const conflictFor = (cls: ClassItem): ClassTeacher | null => {
        if (!selectedSubjectId) return null;
        const sid = Number(selectedSubjectId);
        return cls.teachers?.find((t) => t.subjectId === sid) || null;
    };

    const isReadOnlyClasses = false;

    const subjectName = subjects.find((s) => String(s.id) === selectedSubjectId)?.name || "cette matière";

    // Ouvrir la fenêtre de sélection : on repart de la sélection courante
    const openClassModal = () => {
        if (isReadOnlyClasses) return;
        setDraftClassIds(selectedClassIds);
        setIsClassModalOpen(true);
    };

    // Cocher / décocher dans la fenêtre (sans confirmation : elle vient à l'enregistrement)
    const toggleDraftClass = (cls: ClassItem) => {
        setDraftClassIds((prev) =>
            prev.includes(cls.id) ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
        );
    };

    // Valider la fenêtre : une seule confirmation récapitulative s'il y a des remplacements
    const confirmClassSelection = () => {
        const remplacements = classes
            .filter((c) => draftClassIds.includes(c.id))
            .map((c) => ({ cls: c, conflict: conflictFor(c) }))
            .filter((x) => x.conflict);

        if (remplacements.length > 0) {
            const lignes = remplacements
                .map((x) => `• ${isoler(classLabel(x.cls))} — ${x.conflict!.name || "un enseignant"}`)
                .join("\n");
            const ok = window.confirm(
                `Ces classes ont déjà un enseignant en ${isoler(subjectName)} :\n\n${lignes}\n\n` +
                `Voulez-vous les remplacer ? La classe leur sera retirée.`
            );
            if (!ok) return;
        }

        setSelectedClassIds(draftClassIds);
        setIsClassModalOpen(false);
    };

    // Changer de matière invalide les classes déjà cochées
    const handleSubjectChange = (value: string) => {
        setSelectedSubjectId(value);
        if (selectedClassIds.length > 0) setSelectedClassIds([]);
    };

    const submitForm = async (formData: FormData, confirmReplace: boolean) => {
        if (confirmReplace) formData.set("confirmReplace", "1");

        const res = await fetch("/api/teachers", {
            method: "POST",
            body: formData,
        });

        // 409 : le serveur a détecté un conflit non confirmé
        if (res.status === 409) {
            const data = await res.json();
            const lignes = (data.conflicts || [])
                .map((c: any) => `• ${c.className} — ${c.teacherName} (${c.subjectName})`)
                .join("\n");
            const ok = window.confirm(
                `Ces classes ont déjà un enseignant dans la même matière :\n\n${lignes}\n\n` +
                `Voulez-vous les remplacer ?`
            );
            if (!ok) return false;
            return submitForm(formData, true);
        }

        if (!res.ok) {
            let message = "Erreur lors de la création";
            try {
                const data = await res.json();
                if (data?.error) message = data.error;
            } catch {
                // réponse non JSON : on garde le message générique
            }
            throw new Error(message);
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);

        if (formData.get("password") !== formData.get("confirmPassword")) {
            alert("Les mots de passe ne correspondent pas.");
            setIsLoading(false);
            return;
        }

        // La matière et au moins une classe sont obligatoires à la création
        if (!selectedSubjectId) {
            alert("Veuillez choisir la matière principale.");
            setIsLoading(false);
            return;
        }

        if (selectedClassIds.length === 0) {
            alert("Veuillez sélectionner au moins une classe enseignée.");
            setIsLoading(false);
            openClassModal();
            return;
        }

        // Classes sélectionnées
        formData.set("classIds", JSON.stringify(selectedClassIds));

        try {
            const done = await submitForm(formData, false);
            if (!done) return;

            router.push("/teachers");
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error?.message || "Une erreur est survenue.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link
                    href="/teachers"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nouveau Enseignant</h1>
                    <p className="text-slate-500 text-sm">Ajouter un professeur au corps enseignant.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <div className="w-32 h-32 mx-auto bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200 text-slate-400 mb-4 hover:border-emerald-400 hover:text-emerald-500 transition-colors cursor-pointer group relative overflow-hidden">
                            <Upload className="w-8 h-8 group-hover:scale-110 transition-transform" />
                            <input type="file" name="photo" className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <p className="text-sm font-medium text-slate-900">Photo de profil</p>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5 text-emerald-500" />
                            Informations Personnelles
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nom Complet</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Identifiant Unique</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        name="iuense"
                                        placeholder="Ex: 0012345678"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Matière Principale<span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <select
                                        name="subjectId"
                                        required
                                        value={selectedSubjectId}
                                        onChange={(e) => handleSubjectChange(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                    >
                                        <option value="">Sélectionner...</option>
                                        {subjects.map((subject) => (
                                            <option key={subject.id} value={subject.id}>
                                                {isoler(subject.name)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="email"
                                        name="email"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Téléphone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="tel"
                                        name="phone"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Diplôme</label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        name="diploma"
                                        placeholder="Ex: Mastère"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Genre</label>
                                <select
                                    name="gender"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
                                    <option value="m">Masculin</option>
                                    <option value="f">Féminin</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ===== Classes enseignées ===== */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <School className="w-5 h-5 text-emerald-500" />
                                    Classes enseignées<span className="text-red-500">*</span>
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Au moins une classe est requise pour créer l&apos;enseignant.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openClassModal}
                                disabled={!selectedSubjectId || false}
                                className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-medium text-sm hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <School className="w-4 h-4" />
                                {selectedClassIds.length > 0 ? "Modifier les classes" : "Sélectionner les classes"}
                            </button>
                        </div>

                        {!selectedSubjectId ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                Choisissez d&apos;abord la matière principale pour pouvoir sélectionner les classes.
                            </div>
                        ) : selectedClassIds.length === 0 ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                Aucune classe sélectionnée. Cliquez sur « Sélectionner les classes ».
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {classes
                                    .filter((c) => selectedClassIds.includes(c.id))
                                    .map((c) => (
                                        <span
                                            key={c.id}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200"
                                        >
                                            <bdi>{classLabel(c)}</bdi>
                                        </span>
                                    ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-500" />
                                INFORMATION DE COMPTE
                            </h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nom d&apos;utilisateur<span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="login"
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

                    <div className="flex items-center justify-end gap-4">
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
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {isLoading ? "Enregistrement..." : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Enregistrer L&apos;Enseignant
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Fenêtre de sélection des classes */}
            <AnimatePresence>
                {isClassModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                            onClick={() => setIsClassModalOpen(false)}
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[85vh]"
                            >
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Classes enseignées</h2>
                                        <p className="text-sm text-slate-500">
                                            Matière : <bdi>{subjectName}</bdi>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsClassModalOpen(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto">
                                    {classes.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">Aucune classe disponible.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {classes.map((cls) => {
                                                const conflict = conflictFor(cls);
                                                const checked = draftClassIds.includes(cls.id);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={cls.id}
                                                        onClick={() => toggleDraftClass(cls)}
                                                        className={`text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${
                                                            checked
                                                                ? "border-emerald-500 bg-emerald-50"
                                                                : conflict
                                                                ? "border-amber-200 bg-amber-50/50 hover:border-amber-300"
                                                                : "border-slate-200 bg-slate-50 hover:border-emerald-300"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                                                                checked ? "bg-emerald-600 border-emerald-600" : "border-slate-300 bg-white"
                                                            }`}
                                                        >
                                                            {checked && (
                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path
                                                                        fillRule="evenodd"
                                                                        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                                                                        clipRule="evenodd"
                                                                    />
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block text-sm font-bold text-slate-800"><bdi>{classLabel(cls)}</bdi></span>
                                                            {conflict && !checked && (
                                                                <span className="block text-[11px] font-medium text-amber-700 mt-0.5">
                                                                    Déjà assurée par {conflict.name || "un enseignant"}
                                                                </span>
                                                            )}
                                                            {conflict && checked && (
                                                                <span className="block text-[11px] font-bold text-emerald-700 mt-0.5">
                                                                    Remplacera {conflict.name || "l&apos;enseignant actuel"}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
                                    <span className="text-sm text-slate-500 font-medium">
                                        {draftClassIds.length} classe(s) sélectionnée(s)
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsClassModalOpen(false)}
                                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="button"
                                            onClick={confirmClassSelection}
                                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            Enregistrer
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
}