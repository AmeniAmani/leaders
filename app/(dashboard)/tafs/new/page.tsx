"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Save, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

interface Subject {
    id: number;
    name: string;
}
/*
const currentYear = (() => {
    const now = new Date();
    const year = now.getFullYear();
    return now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
})();*/

export default function NewStudentPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
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
            try {
                const isTeacher = role !== 'admin';
                const classesUrl = isTeacher && idStr ? `/api/classes/teacher/${idStr}` : '/api/classes';
                const subjectsUrl = isTeacher && idStr ? `/api/teachers/${idStr}` : '/api/subjects';

                const [subjectsRes, classesRes] = await Promise.all([
                    fetch(subjectsUrl),
                    fetch(classesUrl),
                ]);

                if (subjectsRes.ok && classesRes.ok) {
                    const subjectsData = await subjectsRes.json();
                    if (isTeacher) {
                        setSubjects(subjectsData.subject ? [subjectsData.subject] : []);
                    } else {
                        setSubjects(subjectsData);
                    }
                    const classesData = await classesRes.json();
                    setClasses(classesData);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);
                    

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        try {
            const res = await fetch("/api/tafs", {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error(await messageErreur(res));

            router.push("/tafs");
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/tafs"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nouveau Devoir / Travail à faire</h1>
                    <p className="text-slate-500 text-sm">Créez un nouveau TAF.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">

                <div className="col mt-6 space-y-3">
                    <div className="space-y-2">
                        {/* Titre */}
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-500" />
                            Informations TAF
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Matiere */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Matière<span className="text-red-500">*</span></label>
                                <select
                                    name="subjectId"
                                    required
                                    defaultValue={subjects.length === 1 ? subjects[0].id : ""}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner une Matière...</option>
                                    {subjects.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Classe */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Classe<span className="text-red-500">*</span></label>
                                <select
                                    name="classId"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner une Classe...</option>
                                    {classes.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.level ? (
                                                (p.level === "1" ? "السابعة أساسي " :
                                                    p.level === "2" ? "الثامنة أساسي " :
                                                        p.level === "3" ? "التاسعة أساسي " : "") + p.name
                                            ) : p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* type */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Type</label>
                                <select
                                    name="type"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
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
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            {/** Description */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Description</label>
                                <textarea
                                    name="description"
                                    placeholder="Ex: Description"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            {/* Pièces jointes */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Pièces jointes</label>
                                <input
                                    type="file"
                                    name="files"
                                    multiple
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="text-right pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
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
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {isLoading ? "Enregistrement..." : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Enregistrer
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
