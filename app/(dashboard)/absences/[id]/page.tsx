"use client";

import { isoler } from "@/lib/bidi";
import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, Trash2, Loader2, CreditCard, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Student {
    id: number;
    firstName: string;
    lastName: string;
}
interface Classe{
    id: number;
    name: string;
    level: string;
    students: Student[];
}

const HOURS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];


export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [isLoading, setIsLoading] = useState(false);
    const [classes, setClasses] = useState<Classe[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [absence, setAbsence] = useState<any>();

    useEffect(() => {
        fetch(`/api/absences/${unwrappedParams.id}`)
            .then(res => res.json())
            .then(setAbsence)
            .catch(error => {
                console.error("Error fetching absence:", error);
                alert("Erreur lors de la lecture ");
            });
    }, [unwrappedParams.id]);

    useEffect(() => {
        if (!absence) return;

        fetch(`/api/classes`)
            .then(res => res.json())
            .then(classesData => {
            setClasses(classesData);
            const selectedClass = classesData.find(
                (c: any) => c.id === absence.classId
            );
            setStudents(selectedClass?.students ?? []);
            })
            .catch(error => {
                console.error("Error fetching absence:", error);
                alert("Erreur lors de la lecture ");
            });
    }, [absence]);



    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const select = e.currentTarget.elements.namedItem("studentId") as HTMLSelectElement;
        const studentName = select.options[select.selectedIndex].text;


        try {
            const res = await fetch(`/api/absences/${unwrappedParams.id}`, {
                method: 'PUT',
                body: JSON.stringify({ studentId: formData.get("studentId"), classId: formData.get("classId"), dateAbsence: formData.get("dateAbsence"), hour: formData.get("hour"), nameStudent: studentName }),
            });

            if (res.ok) {
                router.push("/absences");
            } else {
                alert("Erreur lors de la mise à jour");
            }
        } catch (error) {
            console.error("Failed to update absence", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer cette absence ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/absences/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/absences");
            } else {
                alert("Erreur lors de la suppression");
            }
        } catch (error) {
            console.error("Failed to delete absence", error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedClassId = parseInt(e.target.value);
        const selectedClass = classes.find((c) => c.id === selectedClassId);
        if (selectedClass) {
            setStudents(selectedClass.students);
        } else {
            setStudents([]);
        }
    };

    if (isLoading || !absence) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
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
                        <h1 className="text-2xl font-bold text-slate-900">Modifier Absence</h1>
                        <p className="text-slate-500 text-sm">ID: {absence?.id}</p>
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

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        {/* Titre */}
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5 text-indigo-500" />
                            Informations Elève
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* classe */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Classe</label>
                                <select
                                    name="classId"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    onChange={handleChange}
                                    required
                                    value={absence.classId}
                                >
                                    <option value="">Sélectionner une classe...</option>
                                    {classes.map((cls) => {
                                    const name = (cls.level === "1") ? "السابعة أساسي " + cls.name : (cls.level === "2") ? "الثامنة أساسي " + cls.name : (cls.level === "3") ? "التاسعة أساسي " + cls.name : ""
                                    return (
                                        <option key={cls.id} value={cls.id}>
                                            {isoler(name)}
                                        </option>
                                    )
                                })}
                                </select>
                            </div>
                            {/* eleve */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Elève</label>
                                <select
                                    name="studentId"
                                    value={absence.studentId}
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner un élève...</option>
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Date Absence</label>
                                <input
                                    type="date"
                                    name="dateAbsence"
                                    defaultValue={new Date(absence.dateAbsence).toISOString().split("T")[0]}
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            {/* heure */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Heure</label>
                                <select
                                    name="hour"
                                    required
                                    defaultValue={absence.hour}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner l'heure...</option>
                                    {HOURS.map((h) => (
                                        <option key={h} value={h}>
                                            {h}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/** Description 
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Description</label>
                                <textarea
                                    name="description"
                                    placeholder="Ex: Description"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>*/}
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
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {isLoading ? "Mise à jour..." : (
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
    );
}
