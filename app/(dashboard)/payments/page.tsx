"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Filter, Eye, Trash2, Loader2, CreditCard, User } from "lucide-react";
import { filtreRecherche } from "@/lib/recherche";
import Link from "next/link";
import { motion } from "framer-motion";

interface PaymentLine {
    id: number;
    paymentId: number;
    amount: number;
    title: string;
    type: string;
    numCheque: string | null;
}

interface Payment {
    id: number;
    num: string | null;
    studentId: number;
    student: {
        id: number;
        firstName: string;
        lastName: string;
    } | null;
    as: string;
    paymentDate: string;
    paymentLines: PaymentLine[];
}

export default function StudentsPage() {
    const [totaux, setTotaux] = useState<any[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAS, setSelectedAS] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        return now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
    });
    const [anneeScolaires, setAnneeScolaires] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const currentYear = (() => {
                const now = new Date();
                const year = now.getFullYear();
                return now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
            })();
            setAnneeScolaires([currentYear]);
            const [paymentsRes] = await Promise.all([
                fetch('/api/payments'),
            ]);

            if (paymentsRes.ok) {
                console.log("Fetched payments successfully");
                const paymentsData = await paymentsRes.json();
                setPayments(paymentsData);

                const yearsInDB = Array.from(new Set(paymentsData.map((e: any) => e.as))).filter(Boolean) as string[];
                const allYears = Array.from(new Set([currentYear, ...yearsInDB])).sort((a, b) => b.localeCompare(a));
                setAnneeScolaires(allYears);

                const res = await fetch("/api/payments?p=all&as=all");//fetch(`/api/payments?p=all&as=${selectedAS}`);
                const resData = await res.json();
                setTotaux(resData);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);        
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce payement ?")) {
            try {
                await fetch(`/api/payments/${id}`, { method: 'DELETE' });
                setPayments(payments.filter(p => p.id !== id));
            } catch (err) {
                console.error("Failed to delete", err);
                alert("Erreur lors de la suppression");
            }
        }
    };

    const correspond = filtreRecherche(searchTerm);
    const filteredPayments = payments.filter(payment => {
        const matchesSearch = correspond([payment.student?.firstName, payment.student?.lastName]);
        const matchesAS = selectedAS ? payment.as === selectedAS : true;
        const paymentMonth = new Date(payment.paymentDate).getMonth() + 1; // 1-12
        const matchesMonth = selectedMonth ? paymentMonth === parseInt(selectedMonth) : true;
        return matchesSearch && matchesAS && matchesMonth;
    });

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Gestion des Paiements</h1>
                    <p className="text-slate-500 mt-1">Gérez les paiements des élèves.</p>
                </div>
                <Link href="/payments/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
                    <Plus className="w-5 h-5" />
                    Nouveau Paiement
                </Link>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                {/* Nom student Search Bar */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Rechercher un payement par élève..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* Annee Scolaire Filter */}
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <select
                            value={selectedAS}
                            name="as"
                            onChange={(e) => setSelectedAS(e.target.value)}
                            className="appearance-none pl-10 pr-8 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                        
                            {
                                anneeScolaires.map((as, index) => <option key={index} value={as}>{as}</option>)
                            }
                        </select>
                        </div>
                        {/* Month Filter */}
                        <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <select
                            value={selectedMonth}
                            name="month"
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="appearance-none pl-10 pr-8 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                        <option value="">Tous les mois</option>
                        <option value="1">Janvier</option>
                        <option value="2">Février</option>
                        <option value="3">Mars</option>
                        <option value="4">Avril</option>
                        <option value="5">Mai</option>
                        <option value="6">Juin</option>
                        <option value="7">Juillet</option>
                        <option value="8">Août</option>
                        <option value="9">Septembre</option>
                        <option value="10">Octobre</option>
                        <option value="11">Novembre</option>
                        <option value="12">Décembre</option>
                        </select>
                        </div>
                    </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        {/* Entete tableau */}
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">N° Paiement</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Elève</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Titre</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Montant</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Payé</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Date Payement</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredPayments.map((payment, index) => {
                                const totalAmount = payment.paymentLines?.reduce((sum, line) => sum + (line.amount || 0), 0) || 0;

                                return (
                                    <motion.tr
                                        key={payment.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-slate-50/80 transition-colors group"
                                    >
                                        {/* N° Paiement */}
                                        <td className="p-4">
                                            <span className="text-sm font-semibold text-slate-700">
                                                {payment.num || `-`}
                                            </span>
                                        </td>
                                        {/* student */}
                                        <td className="p-4">
                                            {payment.student ? (
                                                <Link href={`/students?highlight=${payment.studentId}`} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors group-hover/student">
                                                    <div className="p-1.5 bg-slate-100 rounded-full group-hover/student:bg-indigo-100 transition-colors">
                                                        <User className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-sm font-medium">{payment.student.firstName} {payment.student.lastName}</span>
                                                </Link>
                                            ) : (
                                                <span className="text-slate-400 text-sm">Non assigné</span>
                                            )}
                                        </td>
                                        {/* Titre */}
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {payment.paymentLines && payment.paymentLines.length > 0 ? (
                                                    payment.paymentLines.map((line, idx) => (
                                                        <span key={idx} className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                                            {line.title}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400 text-sm">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Montant */}
                                        <td className="p-4">
                                            <span className="text-sm font-semibold text-slate-900">{totalAmount} DT</span>
                                        </td>
                                        {/* Total Payer */}
                                        <td className="p-4">
                                            <span className="text-sm font-medium text-slate-500">
                                                {totaux.find(item => item.studentId === payment.studentId && item.as === selectedAS)?._sum.amount || 0} DT
                                            </span>
                                        </td>
                                        {/* Date */}
                                        <td className="p-4">
                                            <span className="text-sm font-medium">{new Date(payment.paymentDate).toLocaleDateString("fr-FR")}</span>
                                        </td>
                                        {/* Actions */}
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/payments/${payment.id}`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all" title="Voir profil">
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(payment.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredPayments.length === 0 && (
                    <div className="p-12 text-center text-slate-400 bg-slate-50/50">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Aucun Payement trouvé.</p>
                    </div>
                )}
            </div>
        </div>
    );
}


