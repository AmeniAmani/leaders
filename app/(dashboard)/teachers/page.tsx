"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect } from "react";
import { Search, Plus, Mail, Phone, BookOpen, MoreHorizontal, LayoutGrid, Filter, Loader2 } from "lucide-react";
import { filtreRecherche } from "@/lib/recherche";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export default function TeachersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [teachers, setTeachers] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        try {
            const res = await fetch('/api/teachers');
            const resSubjects = await fetch('/api/subjects');
            if (resSubjects.ok) {
                const dataSubjects = await resSubjects.json();
                setSubjects(dataSubjects);
            }
            if (res.ok) {
                const data = await res.json();
                setTeachers(data);
            }
        } catch (error) {
            console.error("Failed to fetch teachers", error);
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

    // Nom (ou identifiant), matière et téléphone
    const correspond = filtreRecherche(searchTerm);
    const filteredTeachers = teachers.filter(teacher =>
        correspond([teacher.name || teacher.user?.login, teacher.subject?.name], [teacher.phone]) &&
        (selectedSubject ? teacher.subjectId === Number(selectedSubject) : true)
    );

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Enseignants</h1>
                        <p className="text-slate-500 mt-1">Gérez le corps professoral.</p>
                    </div>
                    {!isReadOnly && <Link href="/teachers/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95">
                        <Plus className="w-5 h-5" />
                        Ajouter Enseignant
                    </Link>}
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    {/* Search Bar Name teacher*/}
                    <div className="relative w-full flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-slate-700 font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Matiere */}
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <select
                        value={selectedSubject}
                        name="subject"
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="appearance-none pl-10 pr-8 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                        <option value="">Toutes les matières</option>

                        {
                            subjects.map(subject => <option key={subject.id} value={subject.id}>{isoler(subject.name)}</option>)
                        }
                    </select>
                    </div>
                </div>
                </div>

                {/* Grid View */}
                {viewMode === "grid" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTeachers.map((teacher, index) => (
                            <motion.div
                                key={teacher.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all group overflow-hidden"
                            >
                                <div className="p-6">
                                    <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-md mx-auto relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={teacher.photo || "/avatars/teacher-1.png"} alt={teacher.name || teacher.user?.login} className="w-full h-full object-cover rounded-xl"
                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + (teacher.name || teacher.user?.login) }} />
                                    </div>
                                    <div className="text-center mt-3">
                                        <Link href={`/teachers/${teacher.id}`} className="font-bold text-slate-900 text-lg hover:text-emerald-600 transition-colors block">
                                            {teacher.name || teacher.user?.login}
                                        </Link> <br />
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
                                            <BookOpen className="w-3.5 h-3.5" />
                                            <bdi>{teacher.subject?.name || "N/A"}</bdi>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex justify-center gap-3">
                                        <button className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Mail className="w-5 h-5" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{teacher?.email}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </button>
                                        <button className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Phone className="w-5 h-5" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{teacher?.phone}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}
