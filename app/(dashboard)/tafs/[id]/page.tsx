"use client";

import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, Trash2, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

interface Mat {
    id: number;
    name: string;
    level?: string;
}


export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [isLoading, setIsLoading] = useState(false);
    const [taf, setTaf] = useState<any>();
    const [subjects, setSubjects] = useState<Mat[]>([]);
    const [classes, setClasses] = useState<Mat[]>([]);

    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const getCookie = (name: string) => {
        if (typeof document === "undefined") return null;
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] ?? null;
    };

    useEffect(() => {
        const role = getCookie("user-role");
        const idStr = getCookie("user-id");
        setUserRole(role);
        setUserId(idStr);

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const isTeacher = role !== 'admin';
                const classesUrl = isTeacher && idStr ? `/api/classes/teacher/${idStr}` : '/api/classes';
                const subjectsUrl = isTeacher && idStr ? `/api/teachers/${idStr}` : '/api/subjects';

                const [tafRes, subjectsRes, classesRes] = await Promise.all([
                    fetch(`/api/tafs/${unwrappedParams.id}`),
                    fetch(subjectsUrl),
                    fetch(classesUrl),
                ]);

                if (tafRes.ok && subjectsRes.ok && classesRes.ok) {
                    const [tafData, subjectsData, classesData] = await Promise.all([
                        tafRes.json(),
                        subjectsRes.json(),
                        classesRes.json()
                    ]);
                    setTaf(tafData);
                    if (isTeacher) {
                        setSubjects(subjectsData.subject ? [subjectsData.subject] : []);
                    } else {
                        setSubjects(subjectsData);
                    }
                    setClasses(classesData);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [unwrappedParams.id]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [filesToDelete, setFilesToDelete] = useState<number[]>([]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        filesToDelete.forEach(id => formData.append("filesToDelete", String(id)));

        try {
            const res = await fetch(`/api/tafs/${unwrappedParams.id}`, {
                method: 'PUT',
                body: formData,
            });

            if (res.ok) {
                router.push("/tafs");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to update taf", error);
            alert(messageException(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer ce TAF ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/tafs/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/tafs");
            } else {
                alert("Erreur lors de la suppression");
            }
        } catch (error) {
            console.error("Failed to delete taf", error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading || !taf) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/payments"
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Modifier TAF</h1>
                        <p className="text-slate-500 text-sm">ID: {taf?.id}</p>
                    </div>
                </div>
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Supprimer
                </button>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">

                        {/* Titre */}
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-500" />
                            Informations du TAF
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Matiere */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Matière<span className="text-red-500">*</span></label>
                                <select
                                    name="subjectId"
                                    required
                                    defaultValue={taf?.subjectId}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner une matière...</option>
                                    {subjects.map((subject) => (
                                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Classe */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Classe<span className="text-red-500">*</span></label>
                                <select
                                    name="classId"
                                    required
                                    defaultValue={taf?.classId}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner une classe...</option>
                                    {classes.map((classe) => (
                                        <option key={classe.id} value={classe.id}>
                                            {classe.level ? (
                                                (classe.level === "1" ? "السابعة أساسي " :
                                                    classe.level === "2" ? "الثامنة أساسي " :
                                                        classe.level === "3" ? "التاسعة أساسي " : "") + classe.name
                                            ) : classe.name}
                                        </option>
                                    ))}
                                </select>
                            </div>                          
                            {/* Type */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Type</label>
                                <select
                                    name="type"
                                    defaultValue={taf?.type}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="devoir">Devoir</option>
                                    <option value="taf">Travail à faire</option>
                                </select>
                            </div>
                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Date<span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    name="dateTaf"
                                    required
                                    defaultValue={new Date(taf?.dateTaf).toISOString().split('T')[0]}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            {/** Description */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Description</label>
                                <textarea
                                    name="description"
                                    defaultValue={taf?.description}
                                    placeholder="Ex: Description"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>

                            {/* Pièces jointes actuelles */}
                            {(taf.files && taf.files.length > 0) && (
                                <div className="space-y-4 md:col-span-2">
                                    <label className="text-sm font-medium text-slate-700">Pièces jointes actuelles</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {taf.files.filter((f: any) => !filesToDelete.includes(f.id)).map((f: any) => (
                                            <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl group/file transition-all hover:border-slate-300">
                                                <div className="flex items-center gap-2 truncate">
                                                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                                    </div>
                                                    <a 
                                                        href={`/uploads/tafs/${f.name}`} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="text-sm font-medium text-slate-600 hover:text-indigo-600 truncate transition-colors"
                                                    >
                                                        {f.name}
                                                    </a>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setFilesToDelete([...filesToDelete, f.id])}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all shadow-sm"
                                                    title="Supprimer cette pièce jointe"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {taf.files.filter((f: any) => !filesToDelete.includes(f.id)).length === 0 && (
                                            <div className="text-sm text-slate-400 italic">Toutes les pièces jointes existantes seront supprimées.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Ajouter des nouveaux fichiers */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-700">Ajouter des pièces jointes</label>
                                <input
                                    type="file"
                                    name="files"
                                    multiple
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                />
                                <p className="text-[11px] text-slate-400">Vous pouvez sélectionner plusieurs fichiers à la fois.</p>
                            </div>
                        </div>
                    
                    {/* Boutons */}
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
                            disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Mise à jour...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Mettre à jour
                                </>
                            )}
                        </button>
                    </div>
                
            </form>
        </div>
    );
}
