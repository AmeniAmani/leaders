"use client";

import { isoler } from "@/lib/bidi";
import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, Trash2, Loader2, CreditCard, Plus, Printer } from "lucide-react";
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

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [isLoading, setIsLoading] = useState(false);
    const [payment, setPayment] = useState<any>();
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
            setIsLoading(true);
            try {
                setAnneeScolaires([currentYear]);
                
                const [paymentRes, studentsRes, asRes, classesRes] = await Promise.all([
                    fetch(`/api/payments/${unwrappedParams.id}`),
                    fetch('/api/students'),
                    fetch('/api/payments/as'),
                    fetch('/api/classes')
                ]);

                if (studentsRes.ok && paymentRes.ok && asRes.ok && classesRes.ok) {
                    const [s, p, asData, classesData] = await Promise.all([
                        paymentRes.json(),
                        studentsRes.json(),
                        asRes.json(),
                        classesRes.json()
                    ]);
                    setPayment(s);
                    setStudents(p);
                    setClasses(classesData);

                    if (s.student && s.student.classId) {
                        setSelectedClassId(String(s.student.classId));
                    }

                    if (s.paymentLines && s.paymentLines.length > 0) {
                        setLines(s.paymentLines.map((line: any) => ({
                            amount: String(line.amount),
                            title: line.title,
                            type: line.type,
                            numCheque: line.numCheque || ""
                        })));
                    }

                    const yearsInDB = Array.from(new Set(asData.map((e: any) => e.as))).filter(Boolean) as string[];
                    const allYears = Array.from(new Set([currentYear, ...yearsInDB]))
                        .sort((a, b) => b.localeCompare(a));
                    setAnneeScolaires(allYears);
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
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const studentId = formData.get("studentId");
        const num = formData.get("num");
        const as = formData.get("as");

        // Validate at least one line has amount and title
        const validLines = lines.filter(l => l.amount && l.title);
        if (validLines.length === 0) {
            alert("Veuillez saisir au moins une ligne de paiement valide avec montant et titre.");
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await fetch(`/api/payments/${unwrappedParams.id}`, {
                method: 'PUT',
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

            if (res.ok) {
                router.push("/payments");
                router.refresh();
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to update payment", error);
            alert(messageException(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer ce paiement ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/payments/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/payments");
                router.refresh();
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to delete payment", error);
            alert(messageException(error));
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter students by selected class
    const filteredStudents = selectedClassId
        ? students.filter(s => s.classId === Number(selectedClassId))
        : students;

    if (isLoading || !payment) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const currentStudent = students.find(s => s.id === payment.studentId);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Screen layout wrapped in print:hidden */}
            <div className="print:hidden space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/payments"
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Modifier Paiement</h1>
                            <p className="text-slate-500 text-sm">ID: {payment?.id}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 font-medium hover:bg-indigo-100 hover:text-indigo-700 transition-colors flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimer le Reçu
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Supprimer
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* En-tête de Paiement */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-indigo-500" />
                                Entête du paiement
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
                                                <option key={c.id} value={c.id}>{isoler(name)}</option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* student */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Elève<span className="text-red-500">*</span></label>
                                    <select
                                        name="studentId"
                                        defaultValue={payment?.studentId}
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
                                        defaultValue={payment?.num || ""}
                                        placeholder="Ex: P-001"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>

                                {/* Annee Scolaire */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Année Scolaire<span className="text-red-500">*</span></label>
                                    <select
                                        name="as"
                                        defaultValue={payment?.as}
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
                    </div>
                </form>
            </div>

            {/* Print-only receipt layout */}
            <div className="hidden print:block p-10 space-y-8 max-w-2xl mx-auto border border-slate-300 rounded-2xl bg-white text-slate-800">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-indigo-700 tracking-tight">LEADERS SCHOOL</h1>
                        <p className="text-sm font-semibold text-slate-500">Reçu de Paiement Élève</p>
                    </div>
                    <div className="text-right text-sm space-y-1">
                        <p className="font-semibold">N° Reçu : <span className="text-indigo-600">{payment?.num || payment?.id}</span></p>
                        <p className="text-slate-500">Date : {new Date(payment?.paymentDate).toLocaleDateString("fr-FR")}</p>
                        <p className="text-slate-500">Année Scolaire : {payment?.as}</p>
                    </div>
                </div>

                {/* Student Info */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                    <p className="text-sm"><span className="font-semibold text-slate-600">Élève :</span> <span className="font-bold text-slate-800">{currentStudent?.firstName} {currentStudent?.lastName}</span></p>
                    {currentStudent?.classId && (
                        <p className="text-sm">
                            <span className="font-semibold text-slate-600">Classe :</span>{' '}
                            <span className="font-bold text-slate-800">
                                {(() => {
                                    const c = classes.find(cls => cls.id === currentStudent.classId);
                                    if (!c) return "N/A";
                                    return <bdi>{(c.level === "1") ? "السابعة أساسي " + c.name : (c.level === "2") ? "الثامنة أساسي " + c.name : (c.level === "3") ? "التاسعة أساسي " + c.name : c.name}</bdi>;
                                })()}
                            </span>
                        </p>
                    )}
                </div>

                {/* Lines Table */}
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-3 text-xs font-bold uppercase text-slate-500 tracking-wider">Titre / Désignation</th>
                                <th className="p-3 text-xs font-bold uppercase text-slate-500 tracking-wider">Mode de Règlement</th>
                                <th className="p-3 text-xs font-bold uppercase text-slate-500 tracking-wider text-right">Montant</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {lines.map((line, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="p-3 text-sm font-medium text-slate-700">{line.title}</td>
                                    <td className="p-3 text-sm text-slate-600 capitalize">
                                        {line.type === "comptant" ? "Espèces" : line.type === "cheque" ? `Chèque (N°: ${line.numCheque})` : line.type}
                                    </td>
                                    <td className="p-3 text-sm font-bold text-slate-800 text-right">{parseFloat(line.amount).toFixed(2)} DT</td>
                                </tr>
                            ))}
                            <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-200">
                                <td colSpan={2} className="p-3 text-sm text-right text-slate-600">Total Général</td>
                                <td className="p-3 text-base text-right text-indigo-700">
                                    {lines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0).toFixed(2)} DT
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Signatures */}
                <div className="flex justify-between pt-16">
                    <div className="text-center w-40">
                        <div className="border-t border-slate-300 pt-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Signature Parent</p>
                        </div>
                    </div>
                    <div className="text-center w-40">
                        <div className="border-t border-slate-300 pt-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Le Caissier / Cachet</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
