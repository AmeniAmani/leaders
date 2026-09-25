"use client";

import { use, useState, useEffect } from "react";
import { ChevronLeft, Save, Upload, User, Calendar, Mail, Phone, MapPin, Trash2, Loader2, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<any>(null);
    const [classes, setClasses] = useState<any[]>([]);
    const [parents, setParents] = useState<any[]>([]);
    const [nbDocuments, setNbDocuments] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [studentRes, classesRes, parentsRes, docsRes] = await Promise.all([
                    fetch(`/api/students/${unwrappedParams.id}`),
                    fetch('/api/classes'),
                    fetch('/api/parents'),
                    fetch(`/api/students/${unwrappedParams.id}/documents`)
                ]);

                if (studentRes.ok && classesRes.ok && parentsRes.ok) {
                    const [s, c, p] = await Promise.all([
                        studentRes.json(),
                        classesRes.json(),
                        parentsRes.json()
                    ]);
                    setStudent(s);
                    setClasses(c);
                    setParents(p);
                }

                if (docsRes.ok) {
                    const d = await docsRes.json();
                    setNbDocuments(Array.isArray(d) ? d.length : 0);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [unwrappedParams.id]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);


        try {
            const res = await fetch(`/api/students/${unwrappedParams.id}`, {
                method: 'PUT',
                body: formData
            });

            if (res.ok) {
                router.push("/students");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to update student", error);
            alert(messageException(error));
        } finally {
            setIsSubmitting(false);
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

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment supprimer cet élève ?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/students/${unwrappedParams.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/students");
            } else {
                alert(await messageErreur(res));
            }
        } catch (error) {
            console.error("Failed to delete student", error);
            alert(messageException(error));
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading || !student) {
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
                        href="/students"
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Modifier Élève</h1>
                        <p className="text-slate-500 text-sm">ID: {student.idenelev}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/students/${unwrappedParams.id}/documents`}
                        className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-2"
                    >
                        <FolderOpen className="w-4 h-4" />
                        Dossier
                        {nbDocuments !== null && nbDocuments > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 text-xs font-bold">
                                {nbDocuments}
                            </span>
                        )}
                    </Link>
                    {!isReadOnly && <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Supprimer
                    </button>}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Photo & Basic Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <div className="w-32 h-32 mx-auto bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200 text-slate-400 mb-4 hover:border-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer group relative overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`../${student.photo}` || "/avatars/student-1.png"}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + student.firstName + '+' + student.lastName }}
                                alt={`${student.firstName} ${student.lastName}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-8 h-8 text-white" />
                            </div>
                            <input type="file" name="photo" className="absolute inset-0 opacity-0 cursor-pointer" disabled={isReadOnly} />
                        </div>
                        <p className="text-sm font-medium text-slate-900">Photo de profil</p>
                        <p className="text-xs text-slate-400 mt-1">JPG, PNG max 2MB</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900">Informations Scolaires</h3>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Classe<span className="text-red-500">*</span></label>
                            <select
                                name="classId"
                                required
                                defaultValue={student.classId}
                                disabled={isReadOnly}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            >
                                <option value="">Choisir une classe</option>
                                {classes.map((c: any) => {
                                    const name = (c.level === "1") ? "السابعة أساسي " + c.name : (c.level === "2") ? "الثامنة أساسي " + c.name : (c.level === "3") ? "التاسعة أساسي " + c.name : ""
                                    return <option key={c.id} value={c.id}>{name}</option>
                                })}
                            </select>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-slate-50">
                            <label className="text-sm font-medium text-slate-700">Parent / Tuteur<span className="text-red-500">*</span></label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <select
                                    name="parentId"
                                    // Une fiche encore sans parent reste modifiable
                                    required={!!student.parentId}
                                    defaultValue={student.parentId}
                                    disabled={isReadOnly}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner un parent...</option>
                                    {parents.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name1}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-right">
                                {!isReadOnly && <Link href="/parents/new" className="text-xs text-indigo-600 font-medium hover:underline">
                                    + Créer un nouveau parent
                                </Link>}
                            </div>
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
                                <label className="text-sm font-medium text-slate-700">Prénom<span className="text-red-500">*</span></label>
                                <input
                                    name="firstName"
                                    required
                                    type="text"
                                    defaultValue={student.firstName}
                                    readOnly={isReadOnly}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nom<span className="text-red-500">*</span></label>
                                <input
                                    name="lastName"
                                    required
                                    type="text"
                                    defaultValue={student.lastName}
                                    readOnly={isReadOnly}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Date de naissance</label>
                                <input
                                    name="birthday"
                                    type="date"
                                    readOnly={isReadOnly}
                                    defaultValue={student.birthday ? new Date(student.birthday).toISOString().split('T')[0] : ''}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Genre</label>
                                <select 
                                    name="gender" 
                                    defaultValue={student.gender}
                                    disabled={isReadOnly} 
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
                                    <option value="m">Masculin</option>
                                    <option value="f">Féminin</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 space-y-2">
                            <label className="text-sm font-medium text-slate-700">Identifiant (Eduserv)</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    name="idenelev"
                                    type="text"
                                    readOnly={isReadOnly}
                                    defaultValue={student.idenelev}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-6 space-y-2">
                            <label className="text-sm font-medium text-slate-700">Téléphone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    name="phone"
                                    type="tel"
                                    readOnly={isReadOnly}
                                    defaultValue={student.phone}
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
                                    readOnly={isReadOnly}
                                    defaultValue={student.address}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm resize-none"
                                />
                            </div>
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
                        {!isReadOnly && <button
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
                        </button>}
                    </div>
                </div>
            </form>
        </div>
    );
}