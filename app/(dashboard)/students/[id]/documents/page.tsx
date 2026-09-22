"use client";

import { use, useState, useEffect } from "react";
import {
    ChevronLeft, Upload, Trash2, Loader2, FileText, FileSpreadsheet,
    Image as ImageIcon, File, Download, FolderOpen, AlertTriangle, Eye, X
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Document {
    id: number;
    name: string;
    fileName: string;
    filePath: string;
    mimeType: string | null;
    size: number | null;
    createdAt: string;
}

// Icône selon le type de fichier
const iconePour = (mime: string | null, fileName: string) => {
    const m = (mime || "").toLowerCase();
    const ext = fileName.toLowerCase().split(".").pop() || "";

    if (m.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) {
        return { Icone: ImageIcon, couleur: "text-purple-600", fond: "bg-purple-50" };
    }
    if (m === "application/pdf" || ext === "pdf") {
        return { Icone: FileText, couleur: "text-red-600", fond: "bg-red-50" };
    }
    if (m.includes("sheet") || m.includes("excel") || ["xlsx", "xls", "csv"].includes(ext)) {
        return { Icone: FileSpreadsheet, couleur: "text-emerald-600", fond: "bg-emerald-50" };
    }
    if (m.includes("word") || ["doc", "docx"].includes(ext)) {
        return { Icone: FileText, couleur: "text-blue-600", fond: "bg-blue-50" };
    }
    return { Icone: File, couleur: "text-slate-500", fond: "bg-slate-100" };
};

// Ce que le navigateur sait afficher directement
const typeApercu = (mime: string | null, fileName: string): "image" | "pdf" | null => {
    const m = (mime || "").toLowerCase();
    const ext = fileName.toLowerCase().split(".").pop() || "";
    if (m.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
    if (m === "application/pdf" || ext === "pdf") return "pdf";
    return null;
};

const tailleLisible = (octets: number | null) => {
    if (!octets) return "";
    if (octets < 1024) return `${octets} o`;
    if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
    return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
};

export default function DocumentsElevePage({ params }: { params: Promise<{ id: string }> }) {
    const unwrapped = use(params);
    const studentId = unwrapped.id;

    const [student, setStudent] = useState<any>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [nom, setNom] = useState("");
    const [fichier, setFichier] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [apercu, setApercu] = useState<Document | null>(null);

    const getCookie = (name: string) => {
        if (typeof document === "undefined") return null;
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] ?? null;
    };

    const [role, setRole] = useState("");
    useEffect(() => { setRole(getCookie("user-role") ?? "N/A"); }, []);
    const isAdmin = role === "admin";

    useEffect(() => {
        const charger = async () => {
            try {
                const [sRes, dRes] = await Promise.all([
                    fetch(`/api/students/${studentId}`),
                    fetch(`/api/students/${studentId}/documents`),
                ]);
                if (sRes.ok) setStudent(await sRes.json());
                if (dRes.ok) {
                    const d = await dRes.json();
                    setDocuments(Array.isArray(d) ? d : []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        charger();
    }, [studentId]);

    const handleUpload = async () => {
        if (!nom.trim()) { alert("Donnez un nom au document."); return; }
        if (!fichier) { alert("Sélectionnez un fichier."); return; }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("name", nom.trim());
            formData.append("file", fichier);

            const res = await fetch(`/api/students/${studentId}/documents`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");

            setDocuments(prev => [data, ...prev]);
            setNom("");
            setFichier(null);
            const input = document.getElementById("champ-fichier") as HTMLInputElement | null;
            if (input) input.value = "";
        } catch (err: any) {
            console.error(err);
            alert(err?.message || "Une erreur est survenue.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (doc: Document) => {
        if (!window.confirm(`Supprimer « ${doc.name} » du dossier ?\n\nCette action est définitive.`)) return;

        setDeletingId(doc.id);
        try {
            const res = await fetch(`/api/students/${studentId}/documents`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId: doc.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");

            setDocuments(prev => prev.filter(d => d.id !== doc.id));
        } catch (err: any) {
            console.error(err);
            alert(err?.message || "Erreur lors de la suppression");
        } finally {
            setDeletingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* En-tête */}
            <div className="flex items-center gap-4">
                <Link href="/students" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dossier de l&apos;élève</h1>
                    <p className="text-slate-500 text-sm">
                        {student ? `${student.firstName || ""} ${student.lastName || ""}`.trim() : `Élève ${studentId}`}
                        {` · ${documents.length} pièce(s)`}
                    </p>
                </div>
            </div>

            {/* Ajout d'une pièce */}
            {isAdmin && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-indigo-500" />
                        Ajouter une pièce
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Nom du document<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={nom}
                                onChange={(e) => setNom(e.target.value)}
                                placeholder="Ex : Extrait de naissance"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Fichier<span className="text-red-500">*</span>
                            </label>
                            <input
                                id="champ-fichier"
                                type="file"
                                onChange={(e) => setFichier(e.target.files?.[0] || null)}
                                className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-60 whitespace-nowrap"
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Ajouter
                        </button>
                    </div>

                    <p className="text-xs text-slate-400 mt-3">
                        PDF, image, scan, tableur, document Word… 10 Mo maximum. Le nom saisi est celui qui s&apos;affichera dans le dossier.
                    </p>
                </div>
            )}

            {/* Liste des pièces */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {documents.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Aucune pièce dans ce dossier.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        <AnimatePresence>
                            {documents.map((doc, index) => {
                                const { Icone, couleur, fond } = iconePour(doc.mimeType, doc.fileName);
                                return (
                                    <motion.div
                                        key={doc.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="flex items-center gap-4 p-4 hover:bg-slate-50/80 transition-colors group"
                                    >
                                        <div className={`w-11 h-11 rounded-xl ${fond} ${couleur} flex items-center justify-center shrink-0`}>
                                            <Icone className="w-5 h-5" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 truncate">{doc.name}</p>
                                            <p className="text-xs text-slate-400 truncate">
                                                {doc.fileName}
                                                {doc.size ? ` · ${tailleLisible(doc.size)}` : ""}
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0 hidden sm:block">
                                            <p className="text-xs font-medium text-slate-600">
                                                {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {new Date(doc.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => setApercu(doc)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                                title="Aperçu"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={doc.filePath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={doc.fileName}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Télécharger"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDelete(doc)}
                                                    disabled={deletingId === doc.id}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                                    title="Supprimer"
                                                >
                                                    {deletingId === doc.id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Aperçu du document */}
            <AnimatePresence>
                {apercu && (() => {
                    const type = typeApercu(apercu.mimeType, apercu.fileName);
                    return (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                                onClick={() => setApercu(null)}
                            />
                            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col"
                                    style={{ height: type ? "88vh" : "auto" }}
                                >
                                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0 gap-4">
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 truncate">{apercu.name}</p>
                                            <p className="text-xs text-slate-400 truncate">
                                                {apercu.fileName}
                                                {apercu.size ? ` · ${tailleLisible(apercu.size)}` : ""}
                                                {` · ajouté le ${new Date(apercu.createdAt).toLocaleDateString("fr-FR")}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <a
                                                href={apercu.filePath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={apercu.fileName}
                                                className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                Télécharger
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => setApercu(null)}
                                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-auto bg-slate-100">
                                        {type === "image" ? (
                                            <div className="h-full flex items-center justify-center p-4">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={apercu.filePath}
                                                    alt={apercu.name}
                                                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                                                />
                                            </div>
                                        ) : type === "pdf" ? (
                                            <iframe
                                                src={apercu.filePath}
                                                title={apercu.name}
                                                className="w-full h-full border-0 bg-white"
                                            />
                                        ) : (
                                            <div className="p-12 text-center">
                                                <File className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                                                <p className="font-bold text-slate-700">Aperçu indisponible</p>
                                                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                                                    Ce type de fichier ne peut pas s&apos;afficher dans le navigateur.
                                                    Téléchargez-le pour l&apos;ouvrir avec le logiciel adapté.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    );
                })()}
            </AnimatePresence>

            {isAdmin && documents.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500">
                        Les pièces du dossier contiennent des données personnelles. Ne conservez que ce qui est nécessaire
                        et supprimez les documents devenus inutiles.
                    </p>
                </div>
            )}
        </div>
    );
}