"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Save, CreditCard, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

interface Student {
    id: number;
    firstName: string;
    lastName: string;
    classId?: number | null;
}

interface Class {
    id: number;
    name: string;
    level: string | null;
}

const currentYear = (() => {
    const now = new Date();
    const year = now.getFullYear();
    return now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
})();

export default function NewStudentPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [anneeScolaires, setAnneeScolaires] = useState<string[]>([]);
    
    // Manage dynamic lines
    const [lines, setLines] = useState<Array<{
        amount: string;
        title: string;
        type: string;
        numCheque: string;
    }>>([{ amount: "", title: "", type: "comptant", numCheque: "" }]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setAnneeScolaires([currentYear]);

                const [studentsRes, asRes, classesRes] = await Promise.all([
                    fetch('/api/students'),
                    fetch('/api/payments/as'),
                    fetch('/api/classes'),
                ]);

                if (studentsRes.ok && asRes.ok && classesRes.ok) {
                    const studentsData = await studentsRes.json();
                    setStudents(studentsData);

                    const asData = await asRes.json();
                    const yearsInDB = Array.from(new Set(asData.map((e: any) => e.as))).filter(Boolean) as string[];
                    const allYears = Array.from(new Set([currentYear, ...yearsInDB]))
                        .sort((a, b) => b.localeCompare(a));
                    setAnneeScolaires(allYears);

                    const classesData = await classesRes.json();
                    setClasses(classesData);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const handleAddLine = () => {
        setLines([...lines, { amount: "", title: "", type: "comptant", numCheque: "" }]);
    };

    const handleRemoveLine = (index: number) => {
        if (lines.length === 1) return;
        setLines(lines.filter((_, i) => i !== index));
    };

    const handleLineChange = (index: number, field: string, value: string) => {
        const updated = [...lines];
        updated[index] = { ...updated[index], [field]: value };
        setLines(updated);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const studentId = formData.get("studentId");
        const num = formData.get("num");
        const as = formData.get("as");

        // Validate at least one line has amount and title
        const validLines = lines.filter(l => l.amount && l.title);
        if (validLines.length === 0) {
            alert("Veuillez saisir au moins une ligne de paiement valide avec montant et titre.");
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/payments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    studentId,
                    num,
                    as,
                    paymentLines: validLines.map(l => ({
                        amount: parseFloat(l.amount),
                        title: l.title,
                        type: l.type,
                        numCheque: l.type === 'cheque' ? l.numCheque : null
                    }))
                }),
            });

            if (!res.ok) throw new Error(await messageErreur(res));

            router.push("/payments");
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    // Filter students by selected class
    const filteredStudents = selectedClassId
        ? students.filter(s => s.classId === Number(selectedClassId))
        : students;

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/payments"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nouveau Paiement</h1>
                    <p className="text-slate-500 text-sm">Créez un nouveau paiement élève.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* En-tête de Paiement */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-500" />
                            Entête du Paiement
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Filtrer par Classe */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Filtrer par Classe</label>
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Toutes les classes</option>
                                    {classes.map((c) => {
                                        const name = (c.level === "1") ? "السابعة أساسي " + c.name : (c.level === "2") ? "الثامنة أساسي " + c.name : (c.level === "3") ? "التاسعة أساسي " + c.name : c.name;
                                        return (
                                            <option key={c.id} value={c.id}>{name}</option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Elève */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Elève<span className="text-red-500">*</span></label>
                                <select
                                    name="studentId"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner un élève...</option>
                                    {filteredStudents.map((s) => (
                                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                                    ))}
                                </select>
                            </div>

                            {/* N° Paiement */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">N° Paiement</label>
                                <input
                                    type="text"
                                    name="num"
                                    placeholder="Ex: P-001"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>

                            {/* Année Scolaire */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Année Scolaire<span className="text-red-500">*</span></label>
                                <select
                                    name="as"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    {anneeScolaires.map((as, index) => (
                                        <option key={index} value={as}>{as}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Lignes de Paiement */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-indigo-500" />
                                Lignes de Paiement
                            </h3>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Ajouter une ligne
                            </button>
                        </div>

                        <div className="space-y-4">
                            {lines.map((line, index) => (
                                <div key={index} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4 animate-in fade-in-50 duration-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ligne #{index + 1}</span>
                                        {lines.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLine(index)}
                                                className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-md hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Titre */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Titre<span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={line.title}
                                                onChange={(e) => handleLineChange(index, "title", e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                            >
                                                <option value="">Sélectionner un titre...</option>
                                                <option value="Inscription">Inscription</option>
                                                <option value="Scolarité">Scolarité</option>
                                                <option value="Cantine">Cantine</option>
                                                <option value="Panier">Panier</option>
                                                <option value="Club">Club</option>
                                                <option value="Extras">Extras</option>
                                            </select>
                                        </div>

                                        {/* Montant */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Montant (DT)<span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                required
                                                min="0.01"
                                                step="any"
                                                placeholder="Ex: 100"
                                                value={line.amount}
                                                onChange={(e) => handleLineChange(index, "amount", e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                            />
                                        </div>

                                        {/* Type */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Mode de Règlement<span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={line.type}
                                                onChange={(e) => handleLineChange(index, "type", e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                            >
                                                <option value="comptant">Comptant</option>
                                                <option value="cheque">Chèque</option>
                                                <option value="virement">Virement</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Cheque Number (conditional) */}
                                    {line.type === "cheque" && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                            <div className="md:col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-slate-700">N° de Chèque<span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Saisir le numéro du chèque"
                                                    value={line.numCheque}
                                                    onChange={(e) => handleLineChange(index, "numCheque", e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
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
