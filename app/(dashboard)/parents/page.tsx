"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Mail, Phone, GraduationCap, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export default function ParentsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const searchParams = useSearchParams();
    const highlightId = searchParams.get("highlight");

    const [parents, setParents] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Auto-expand searched parent or highlighted parent
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    useEffect(() => {
        if (highlightId) {
            setExpandedIds([highlightId]);
            // Scroll to element could be added here
        }
    }, [highlightId]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [parentsRes, studentsRes] = await Promise.all([
                fetch('/api/parents'),
                fetch('/api/students')
            ]);

            if (parentsRes.ok) setParents(await parentsRes.json());
            if (studentsRes.ok) setStudents(await studentsRes.json());
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Recherche sans tenir compte de la casse, des accents ni des espaces en trop
    const normaliser = (s: unknown) =>
        String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const chiffres = (s: unknown) => String(s ?? "").replace(/\D/g, "");

    // Chaque mot tapé doit se retrouver quelque part : noms des tuteurs, noms des
    // enfants ou téléphones (comparés chiffres seuls : « 22 123 » trouve « 22123456 »)
    const mots = normaliser(searchTerm).split(" ").filter(Boolean);
    const filteredParents = mots.length === 0 ? parents : parents.filter(parent => {
        const enfants = students.filter(s => s.parentId === parent.id);
        const texte = normaliser([
            parent.name1, parent.name2,
            ...enfants.map(e => `${e.firstName || ""} ${e.lastName || ""}`),
        ].join(" "));
        const telephones = [parent.phone1, parent.phone2].map(chiffres).filter(Boolean);
        return mots.every(mot => {
            if (texte.includes(mot)) return true;
            const num = chiffres(mot);
            return num.length > 0 && num.length === mot.replace(/[\s.+()-]/g, "").length && telephones.some(t => t.includes(num));
        });
    });

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Gestion des Parents</h1>
                    <p className="text-slate-500 mt-1">Coordonnées et liens familiaux.</p>
                </div>
                <Link href="/parents/new" className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-pink-500/20 flex items-center gap-2 transition-all active:scale-95">
                    <Plus className="w-5 h-5" />
                    Nouveau Parent
                </Link>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Rechercher un parent..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-pink-500/20 outline-none text-slate-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid of Parents */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredParents.map((parent, index) => {
                    // Filter children from the students list where parentId matches
                    const children = students.filter(s => s.parentId === parent.id);
                    const isExpanded = expandedIds.includes(String(parent.id));

                    return (
                        <motion.div
                            key={parent.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                "bg-white rounded-2xl border shadow-sm transition-all duration-300 overflow-hidden group",
                                highlightId === String(parent.id) ? "ring-2 ring-pink-500 border-pink-500 shadow-pink-100" : "border-slate-100 hover:shadow-md hover:border-slate-200"
                            )}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 font-bold text-xl">
                                            {parent.name1 ? parent.name1.charAt(0) : "P"}
                                        </div>
                                        <div>
                                            <Link href={`/parents/${parent.id}`} className="font-bold text-slate-800 text-lg hover:text-pink-600 transition-colors">
                                                {parent.name1}
                                            </Link>
                                            <p className="text-slate-400 text-sm">Parent de {children.length} élève{children.length > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-3">
                                    <div className="flex items-center gap-3 text-slate-600 text-sm">
                                        <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">
                                            <Mail className="w-4 h-4" />
                                        </div>
                                        <span>{parent.email1}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600 text-sm">
                                        <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">
                                            <Phone className="w-4 h-4" />
                                        </div>
                                        <span>{parent.phone1}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Children Section (Expandable) */}
                            <div className="bg-slate-50/50 border-t border-slate-100">
                                <button
                                    onClick={() => toggleExpand(String(parent.id))}
                                    className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    <span>Enfants associés</span>
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: "auto" }}
                                            exit={{ height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-4 pt-0 space-y-2">
                                                {children.length > 0 ? (
                                                    children.map(child => (
                                                        <Link
                                                            href={`/students?highlight=${child.id}`}
                                                            key={child.id}
                                                            className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all group/child"
                                                        >
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={child.photo || "/avatars/student-1.png"} alt={child.firstName + " " + child.lastName} className="w-full h-full object-cover"
                                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + child.firstName + '+' + child.lastName }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-700 group-hover/child:text-indigo-600 transition-colors">{child.firstName + " " + child.lastName}</p>
                                                                <span className="text-xs text-slate-400">Voir profil</span>
                                                            </div>
                                                            <ChevronDown className="w-4 h-4 ml-auto -rotate-90 text-slate-300 group-hover/child:text-indigo-400" />
                                                        </Link>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic px-2">Aucun enfant associé.</p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
