"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect } from "react";
import { ChevronLeft, Save, Upload, User, Calendar, Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import ParentForm from "@/components/forms/ParentForm";

interface Parent {
    id: number;
    name1: string;
}

interface Class {
    id: number;
    level: string;
    name: string;
}

export default function NewStudentPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [parents, setParents] = useState<Parent[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [isParentModalOpen, setIsParentModalOpen] = useState(false);
    const [selectedParentId, setSelectedParentId] = useState<string>("");
    const [selectedClassId, setSelectedClassId] = useState<string>("");

    const fetchParents = async () => {
        try {
            const res = await fetch('/api/parents');
            if (res.ok) {
                const data = await res.json();
                setParents(Array.isArray(data) ? data : []);
                return data;
            }
        } catch (error) {
            console.error("Error fetching parents:", error);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [parentsData, classesRes] = await Promise.all([
                    fetchParents(),
                    fetch('/api/classes')
                ]);

                if (classesRes.ok) {
                    const classesData = await classesRes.json();
                    setClasses(Array.isArray(classesData) ? classesData : []);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const handleParentSuccess = async (newParent: { id: number; name: string }) => {
        await fetchParents();
        setSelectedParentId(newParent.id.toString());
        setIsParentModalOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);

        // Champs obligatoires
        const firstName = String(formData.get("firstName") || "").trim();
        const lastName = String(formData.get("lastName") || "").trim();

        if (!firstName) { alert("Le prénom de l'élève est obligatoire."); return; }
        if (!lastName) { alert("Le nom de l'élève est obligatoire."); return; }
        if (!selectedClassId) { alert("Sélectionnez la classe de l'élève."); return; }
        if (!selectedParentId) { alert("Sélectionnez le parent ou tuteur de l'élève."); return; }

        setIsLoading(true);
        try {
            const res = await fetch("/api/students", {
                method: "POST",
                body: formData,
            });

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

            router.push("/students");
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
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/students"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Nouveau Élève</h1>
                    <p className="text-slate-500 text-sm">Créez un nouveau dossier étudiant.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Photo & Basic Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <div className="w-32 h-32 mx-auto bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200 text-slate-400 mb-4 hover:border-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer group relative overflow-hidden">
                            <Upload className="w-8 h-8 group-hover:scale-110 transition-transform" />
                            <input type="file" name="photo" className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <p className="text-sm font-medium text-slate-900">Photo de profil</p>
                        <p className="text-xs text-slate-400 mt-1">JPG, PNG max 2MB</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900">Informations Scolaires</h3>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                                Classe<span className="text-red-500">*</span>
                            </label>
                            <select
                                name="classId"
                                required
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm ${
                                    selectedClassId ? "border-slate-200" : "border-red-200"
                                }`}
                            >
                                <option value="">Sélectionner...</option>
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

                        <div className="space-y-2 pt-4 border-t border-slate-50">
                            <label className="text-sm font-medium text-slate-700">
                                Parent / Tuteur<span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <select
                                    name="parentId"
                                    required
                                    value={selectedParentId}
                                    onChange={(e) => setSelectedParentId(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm ${
                                        selectedParentId ? "border-slate-200" : "border-red-200"
                                    }`}
                                >
                                    <option value="">Sélectionner un parent...</option>
                                    {parents.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name1}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-right">
                                <button
                                    type="button"
                                    onClick={() => setIsParentModalOpen(true)}
                                    className="text-xs text-indigo-600 font-medium hover:underline"
                                >
                                    + Créer un nouveau parent
                                </button>
                            </div>
                            {parents.length === 0 && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                    Aucun parent enregistré. Créez d&apos;abord le parent avant d&apos;inscrire l&apos;élève.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Personal Details */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5 text-indigo-500" />
                            Informations Personnelles
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Prénom<span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="firstName"
                                    required
                                    placeholder="Ex: Mohamed"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Nom<span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="lastName"
                                    required
                                    placeholder="Ex: Ben Ali"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Date de naissance</label>
                                <input
                                    type="date"
                                    name="birthday"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Genre</label>
                                <select
                                    name="gender"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="m">Masculin</option>
                                    <option value="f">Féminin</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 space-y-2">
                            <label className="text-sm font-medium text-slate-700">Identifiant</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    name="idenelev"
                                    placeholder="Ex: ELE001"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div className="mt-6 space-y-2">
                            <label className="text-sm font-medium text-slate-700">Téléphone (Optionnel)</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="tel"
                                    name="phone"
                                    placeholder="+216 00 000 000"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                        </div>


                        <div className="mt-6 space-y-2">
                            <label className="text-sm font-medium text-slate-700">Adresse</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                <textarea
                                    name="address"
                                    rows={3}
                                    placeholder="Adresse complète..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-4">
                        <p className="mr-auto text-xs text-slate-400">
                            Les champs marqués d&apos;un <span className="text-red-500">*</span> sont obligatoires.
                        </p>
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

            <Dialog open={isParentModalOpen} onOpenChange={setIsParentModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nouveau Parent</DialogTitle>
                    </DialogHeader>
                    <ParentForm
                        onSuccess={handleParentSuccess}
                        onCancel={() => setIsParentModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}