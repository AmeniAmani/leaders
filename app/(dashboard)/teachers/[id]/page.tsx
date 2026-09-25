"use client";

import { isoler } from "@/lib/bidi";
import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, Upload, User, Mail, Phone, BookOpen, Trash2, GraduationCap, X, Loader2, School, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";
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

export default function TeacherDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const teacherId = Number(unwrappedParams.id);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [teacher, setTeacher] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);

    // Matière et classes sélectionnées
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
    const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);

    // Sélection des classes dans une fenêtre dédiée
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [draftClassIds, setDraftClassIds] = useState<number[]>([]);

    // Modal State
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        const fetchRefs = async () => {
            try {
                const [subjectsRes, classesRes] = await Promise.all([
                    fetch("/api/subjects"),
                    fetch("/api/classes"),
                ]);
                if (subjectsRes.ok) setSubjects(await subjectsRes.json());
                if (classesRes.ok) setClasses(await classesRes.json());
            } catch (error) {
                console.error("Error fetching refs:", error);
            }
        };
        fetchRefs();
    }, []);

    useEffect(() => {
        fetchTeacher();
    }, [unwrappedParams.id]);

    const fetchTeacher = async () => {
        try {
            const res = await fetch(`/api/teachers/${unwrappedParams.id}`);
            if (!res.ok) throw new Error("Failed to fetch teacher");
            const data = await res.json();
            setTeacher(data);
            if (data.user) setUser(data.user);

            // Pré-remplir matière et classes actuelles
            setSelectedSubjectId(data.subjectId ? String(data.subjectId) : "");
            setSelectedClassIds(Array.isArray(data.classes) ? data.classes.map((c: any) => c.id) : []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

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

    // Autre enseignant de la même matière déjà rattaché à cette classe.
    // L'enseignant en cours de modification ne peut pas être en conflit avec lui-même.
    const conflictFor = (cls: ClassItem): ClassTeacher | null => {
        if (!selectedSubjectId) return null;
        const sid = Number(selectedSubjectId);
        return cls.teachers?.find((t) => t.subjectId === sid && t.id !== teacherId) || null;
    };

    const subjectName = subjects.find((s) => String(s.id) === selectedSubjectId)?.name || "cette matière";

    // Ouvrir la fenêtre de sélection : on repart de la sélection courante
    const openClassModal = () => {
        if (isReadOnly) return;
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

    const submitForm = async (formData: FormData, confirmReplace: boolean): Promise<boolean> => {
        if (confirmReplace) formData.set("confirmReplace", "1");

        const res = await fetch(`/api/teachers/${unwrappedParams.id}`, {
            method: "PUT",
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

        if (!res.ok) throw new Error(await messageErreur(res));
        return true;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);

        const formData = new FormData(e.currentTarget);
        formData.set("classIds", JSON.stringify(selectedClassIds));

        // La matière et au moins une classe restent obligatoires
        if (!selectedSubjectId) {
            alert("Veuillez choisir la matière principale.");
            setIsSaving(false);
            return;
        }
        if (selectedClassIds.length === 0) {
            alert("Veuillez sélectionner au moins une classe enseignée.");
            setIsSaving(false);
            return;
        }

        try {
            const done = await submitForm(formData, false);
            if (!done) return;

            router.push("/teachers");
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(messageException(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        const nom = teacher?.name || "cet enseignant";

        if (!window.confirm(
            `Supprimer définitivement ${nom} ?\n\n` +
            `Son compte de connexion sera supprimé et ses classes lui seront retirées. ` +
            `Les absences et devoirs qu'il a saisis restent en base.`
        )) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/teachers/${unwrappedParams.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(await messageErreur(res));

            router.push("/teachers");
            router.refresh();
        } catch (err) {
            console.error(err);
            alert(messageException(err));
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError("");

        if (newPassword !== confirmPassword) {
            setPasswordError("Les mots de passe ne correspondent pas.");
            return;
        }

        if (!user || !user.login) {
            setPasswordError("Utilisateur lié introuvable.");
            return;
        }

        setIsResetting(true);
        try {
            const res = await fetch(`/api/users/${user.login}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: newPassword }),
            });

            if (!res.ok) throw new Error(await messageErreur(res));

            setIsPasswordModalOpen(false);
            setNewPassword("");
            setConfirmPassword("");
            alert("Mot de passe mis à jour avec succès.");
        } catch (err) {
            console.error(err);
            setPasswordError(messageException(err));
        } finally {
            setIsResetting(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;
    if (!teacher) return <div className="p-8 text-center text-red-500">Enseignant introuvable.</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/teachers"
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Modifier Enseignant</h1>
                        <p className="text-slate-500 text-sm">ID: {teacher.id}</p>
                    </div>
                </div>
                {!isReadOnly && <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Supprimer
                </button>}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Photo & Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <div className="w-32 h-32 mx-auto bg-slate-50 rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-200 mb-4 cursor-pointer group relative">
                            {teacher.photo ? (
                                <img src={`../${teacher.photo}`} alt={teacher.name || "Teacher"} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-12 h-12 text-slate-400" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-8 h-8 text-white" />
                            </div>
                            <input type="file" name="photo" disabled={isReadOnly} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <p className="text-lg font-bold text-slate-900">{teacher.name}</p>
                    </div>
                </div>

                {/* Right Column: Details */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5 text-emerald-500" />
                            Informations Personnelles
                        </h3>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Nom Complet</label>
                            <input
                                type="text"
                                name="name"
                                readOnly={isReadOnly}
                                defaultValue={teacher.name || ""}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                            />
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
                                        readOnly={isReadOnly}
                                        defaultValue={teacher.iuense || ""}
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
                                        disabled={isReadOnly}
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
                                        readOnly={isReadOnly}
                                        defaultValue={teacher.email || ""}
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
                                        readOnly={isReadOnly}
                                        defaultValue={teacher.phone || ""}
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
                                        defaultValue={teacher.diploma || ""}
                                        disabled={isReadOnly}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Genre</label>
                                <select
                                    name="gender"
                                    defaultValue={teacher.gender || "m"}
                                    disabled={isReadOnly}
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
                                    <span>Classes enseignées<span className="text-red-500">*</span></span>
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Les classes dans lesquelles cet enseignant intervient.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openClassModal}
                                disabled={!selectedSubjectId || isReadOnly}
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
                            <p className="text-sm text-slate-400 italic py-2">
                                Aucune classe sélectionnée pour le moment.
                            </p>
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

                    {!isReadOnly && <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-500" />
                                INFORMATION DE COMPTE
                            </h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nom d&apos;utilisateur</label>
                                <input
                                    type="text"
                                    defaultValue={user?.login || ""}
                                    readOnly
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-500 cursor-not-allowed text-sm"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div>
                                    <p className="font-medium text-slate-900">Mot de passe</p>
                                    <p className="text-sm text-slate-500">********</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsPasswordModalOpen(true)}
                                    className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                >
                                    Réinitialiser le mot de passe
                                </button>
                            </div>
                        </div>
                    </div>}

                    {!isReadOnly && <div className="flex items-center justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSaving ? "..." : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Mettre à jour
                                </>
                            )}
                        </button>
                    </div>}
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

            {/* Password Reset Modal */}
            <AnimatePresence>
                {isPasswordModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                            onClick={() => setIsPasswordModalOpen(false)}
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white w-full max-w-md rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
                            >
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <h2 className="text-lg font-bold text-slate-900">Réinitialiser le mot de passe</h2>
                                    <button
                                        onClick={() => setIsPasswordModalOpen(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handlePasswordReset} className="p-6 space-y-4">
                                    {passwordError && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                                            {passwordError}
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                                        <input
                                            type="password"
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Confirmer le mot de passe</label>
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                        />
                                    </div>

                                    <div className="pt-4 flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsPasswordModalOpen(false)}
                                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isResetting}
                                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Enregistrer
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