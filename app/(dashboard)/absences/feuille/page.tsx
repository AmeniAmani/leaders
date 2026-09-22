"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Printer, FileDown, Loader2, CalendarDays, Users, School, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Slot {
    hour: string;
    hourEnd: string | null;
    teacherName: string | null;
    subjectName: string | null;
    couvert?: boolean;
}
interface Student {
    id: number;
    firstName: string | null;
    lastName: string | null;
}

const classLabel = (c?: { level: string | null; name: string | null } | null) => {
    if (!c) return "";
    const prefix =
        c.level === "1" ? "السابعة أساسي " :
        c.level === "2" ? "الثامنة أساسي " :
        c.level === "3" ? "التاسعة أساسي " : "";
    return prefix + (c.name || "");
};

// Libellé d'un créneau : "13:00 – 15:00" ou "13:00"
const slotLabel = (s: Slot) => s.hourEnd ? `${s.hour} – ${s.hourEnd}` : s.hour;

const todayLocal = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
};

export default function FeuillePresencePage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [classId, setClassId] = useState("");
    const [date, setDate] = useState(todayLocal());

    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetch('/api/classes')
            .then(r => r.ok ? r.json() : [])
            .then(d => setClasses(Array.isArray(d) ? d : []))
            .catch(() => setClasses([]));
    }, []);

    useEffect(() => {
        if (!classId || !date) { setData(null); return; }
        setIsLoading(true);
        fetch(`/api/absences/feuille?classId=${classId}&date=${date}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => setData(d && !d.error ? d : null))
            .catch(() => setData(null))
            .finally(() => setIsLoading(false));
    }, [classId, date]);

    const slots: Slot[] = data?.slots || [];
    const avantPause = slots.filter(s => s.hour < "12:00");
    const apresPause = slots.filter(s => s.hour >= "13:00");

    // La tranche 12h-13h est la pause : elle remplace la colonne horaire
    const colonnes: (Slot | "pause")[] = [...avantPause, "pause", ...apresPause];

    const marque = (studentId: number, hour: string): { mark: string; minutes: number | null } | null =>
        data?.absenceMap?.[`${studentId}-${hour}`] || null;

    const totalAbsences = (studentId: number) =>
        slots.filter(s => s.couvert !== false && marque(studentId, s.hour)).length;

    // Couleurs par type de signalement
    const styleMarque = (m: string) =>
        m === "E" ? "bg-purple-100 text-purple-700 border-purple-300" :
        m === "R" ? "bg-amber-100 text-amber-700 border-amber-300" :
                    "bg-red-100 text-red-700 border-red-300";

    // Aucune séance ni absence saisie ce jour-là : la feuille est vierge
    const estVierge = Boolean(data?.estVierge);

    // Export Excel : tableau HTML mis en forme, ouvert nativement par Excel
    const exporterExcel = () => {
        if (!data) return;

        const esc = (t: any) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const nbCol = 2 + slots.length + 1;

        const b = "border:1pt solid #94A3B8;height:36px;";
        const c = "text-align:center;vertical-align:middle;white-space:nowrap;";

        let html = `<table style="font-family:Calibri,Arial,sans-serif;font-size:15pt;border-collapse:collapse;">`;

        html += `<colgroup><col style="width:60px"/><col style="width:300px"/>`;
        slots.forEach(() => { html += `<col style="width:175px"/>`; });
        html += `<col style="width:100px"/></colgroup>`;

        // Titre
        html += `<tr><td colspan="${nbCol}" style="${c}font-size:13pt;color:#64748B;padding:8px;">GSI &middot; Coll&egrave;ge Les Leaders Boumhel</td></tr>`;
        html += `<tr><td colspan="${nbCol}" style="${c}font-size:24pt;font-weight:bold;color:#0F172A;padding:10px;">Feuille de pr&eacute;sence</td></tr>`;
        html += `<tr><td colspan="${nbCol}" style="${c}font-size:18pt;font-weight:bold;color:#334155;padding:8px;">${esc(classLabel(data.classe))} &mdash; ${esc(data.jour)} ${esc(new Date(data.date).toLocaleDateString("fr-FR"))}</td></tr>`;
        html += `<tr><td colspan="${nbCol}" style="${c}font-size:13pt;color:#64748B;padding:4px 6px 18px;">${data.students.length} &eacute;l&egrave;ve(s)${estVierge ? "" : ` &middot; ${slots.length} s&eacute;ance(s)`}</td></tr>`;

        // En-tête
        html += `<tr>`;
        html += `<td rowspan="3" style="${b}${c}background:#F1F5F9;font-weight:bold;font-size:13pt;color:#475569;">N&deg;</td>`;
        html += `<td rowspan="3" style="${b}vertical-align:middle;background:#F1F5F9;font-weight:bold;font-size:15pt;color:#475569;padding-left:10px;">&Eacute;l&egrave;ve</td>`;
        slots.forEach(sl => {
            html += `<td style="${b}${c}background:#EEF2FF;font-weight:bold;font-size:13pt;color:#312E81;">${sl.couvert === false ? "&#160;" : esc(sl.teacherName || "")}</td>`;
        });
        html += `<td rowspan="3" style="${b}${c}background:#F1F5F9;font-weight:bold;font-size:13pt;color:#475569;">Total</td>`;
        html += `</tr>`;

        html += `<tr>`;
        slots.forEach(sl => {
            html += `<td style="${b}${c}background:#EEF2FF;font-size:13pt;color:#4338CA;">${sl.couvert === false ? "&#160;" : esc(sl.subjectName || "")}</td>`;
        });
        html += `</tr>`;

        html += `<tr>`;
        slots.forEach(sl => {
            html += `<td style="${b}${c}background:#1E293B;color:#FFFFFF;font-weight:bold;font-size:14pt;">${esc(slotLabel(sl))}</td>`;
        });
        html += `</tr>`;

        // Élèves
        (data.students as Student[]).forEach((st, idx) => {
            const fond = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
            html += `<tr>`;
            html += `<td style="${b}${c}background:${fond};font-size:13pt;color:#94A3B8;">${idx + 1}</td>`;
            html += `<td style="${b}background:${fond};font-weight:bold;font-size:15pt;padding-left:10px;">${esc(`${st.firstName || ""} ${st.lastName || ""}`.trim())}</td>`;
            slots.forEach(sl => {
                if (estVierge || sl.couvert === false) {
                    html += `<td style="${b}${c}background:#F8FAFC;">&#160;</td>`;
                    return;
                }
                const m = marque(st.id, sl.hour);
                if (!m) {
                    html += `<td style="${b}${c}background:#ECFDF5;color:#059669;font-weight:bold;font-size:16pt;">P</td>`;
                } else if (m.mark === "E") {
                    html += `<td style="${b}${c}background:#F5F3FF;color:#7C3AED;font-weight:bold;font-size:16pt;">E</td>`;
                } else if (m.mark === "R") {
                    html += `<td style="${b}${c}background:#FFFBEB;color:#B45309;font-weight:bold;font-size:15pt;">R${m.minutes ? ` ${m.minutes}'` : ""}</td>`;
                } else {
                    html += `<td style="${b}${c}background:#FEF2F2;color:#DC2626;font-weight:bold;font-size:16pt;">A</td>`;
                }
            });
            const total = estVierge ? 0 : totalAbsences(st.id);
            html += `<td style="${b}${c}background:${fond};font-weight:bold;font-size:15pt;color:${total > 0 ? "#DC2626" : "#CBD5E1"};">${estVierge ? "" : total}</td>`;
            html += `</tr>`;
        });

        // Légende et visa
        html += `<tr><td colspan="${nbCol}" style="height:16px;"></td></tr>`;
        html += `<tr><td colspan="${nbCol}" style="font-size:13pt;color:#64748B;padding:6px;white-space:nowrap;">P = Pr&eacute;sent &#160; A = Absent &#160; E = Exclus &#160; R = Retard (minutes)</td></tr>`;
        html += `<tr><td colspan="${nbCol}" style="height:28px;"></td></tr>`;
        html += `<tr><td colspan="${nbCol}" style="font-size:13pt;color:#64748B;padding:6px;white-space:nowrap;">Signature du directeur / Cachet : ____________________</td></tr>`;

        html += `</table>`;

        const doc =
            `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/>` +
            `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>` +
            `<x:Name>Presence</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>` +
            `</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->` +
            `</head><body>${html}</body></html>`;

        const blob = new Blob(["\uFEFF" + doc], { type: "application/vnd.ms-excel;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `presence_${classLabel(data.classe).replace(/\s+/g, "_")}_${data.date}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <style jsx global>{`
                @media print {
                    @page { size: A4 landscape; margin: 0.8cm; }
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: white !important; }
                    .no-print { display: none !important; }
                    main { padding: 0 !important; }
                    .feuille { box-shadow: none !important; border: none !important; padding: 0 !important; }
                    table { font-size: 9.5px !important; }
                    .cell-mark { width: 20px !important; height: 20px !important; font-size: 11px !important; }
                }
            `}</style>

            {/* Barre d'outils */}
            <div className="no-print space-y-4">
                {/* Titre */}
                <div className="flex items-center gap-4">
                    <Link href="/absences" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Feuille de présence</h1>
                        <p className="text-slate-500 text-sm">Récapitulatif de la journée, classe par classe.</p>
                    </div>
                </div>

                {/* Carte de sélection */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Classe</label>
                        <div className="relative">
                            <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <select
                                value={classId}
                                onChange={(e) => setClassId(e.target.value)}
                                className="w-full appearance-none pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-slate-700"
                            >
                                <option value="">Choisir une classe...</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{classLabel(c)}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-slate-700"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={exporterExcel}
                            disabled={!data}
                            className="px-4 py-2.5 rounded-xl bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 border border-slate-300 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <FileDown className="w-4 h-4 text-emerald-600" />
                            Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            disabled={!data}
                            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimer
                        </button>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="flex h-64 items-center justify-center no-print">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            {!isLoading && !classId && (
                <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100 no-print">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Choisissez une classe et une date pour afficher la feuille.</p>
                </div>
            )}

            {!isLoading && data && (
                <div className="feuille bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                    {/* En-tête du document */}
                    <div className="mb-6 pb-4 border-b-[3px] border-slate-900">
                        <div className="flex justify-between items-start gap-6">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em]">
                                    GSI · Collège Les Leaders Boumhel
                                </p>
                                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mt-1.5">
                                    Feuille de présence
                                </h2>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xl font-black text-slate-900">{classLabel(data.classe)}</p>
                                <p className="text-sm font-bold text-slate-600 mt-0.5">
                                    {data.jour} {new Date(data.date).toLocaleDateString("fr-FR")}
                                </p>
                                <p className="text-xs text-slate-400 mt-1 flex items-center justify-end gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    {data.students.length} élève(s){estVierge ? "" : ` · ${slots.filter(s => s.couvert).length} séance(s)`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {data.students.length === 0 ? (
                        <p className="text-slate-400 italic text-center py-10">Aucun élève dans cette classe.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    {/* Enseignant */}
                                    <tr>
                                        <th className="border border-slate-300 bg-slate-100 px-2 py-2 text-center text-[10px] font-bold text-slate-500 w-10" rowSpan={3}>
                                            N°
                                        </th>
                                        <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider" rowSpan={3}>
                                            Élève
                                        </th>
                                        {colonnes.map((c, i) => c === "pause" ? (
                                            <th key={`p-${i}`} rowSpan={3} className="border border-slate-300 bg-amber-100/70 px-1 py-2 text-center align-middle" style={{ width: "30px" }}>
                                                <span className="text-[9px] font-black text-amber-800 uppercase tracking-[0.2em] whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                                                    Pause 12h – 13h
                                                </span>
                                            </th>
                                        ) : (
                                            <th key={`t-${c.hour}`} className={`border border-slate-300 px-2 py-1.5 text-center text-[10px] font-bold leading-tight ${
                                                c.couvert === false ? "bg-slate-50 text-slate-300" : "bg-indigo-50 text-indigo-900"
                                            }`}>
                                                {c.teacherName || ""}
                                            </th>
                                        ))}
                                        <th className="border border-slate-300 bg-slate-100 px-2 py-2 text-center text-[10px] font-bold text-slate-500 w-14" rowSpan={3}>
                                            Total<br />signal.
                                        </th>
                                    </tr>
                                    {/* Matière */}
                                    <tr>
                                        {colonnes.map((c) => c === "pause" ? null : (
                                            <th key={`s-${c.hour}`} className={`border border-slate-300 px-2 py-1 text-center text-[10px] font-medium leading-tight ${
                                                c.couvert === false ? "bg-slate-50 text-slate-300" : "bg-indigo-50/50 text-indigo-700/80"
                                            }`}>
                                                {c.subjectName || ""}
                                            </th>
                                        ))}
                                    </tr>
                                    {/* Créneau horaire */}
                                    <tr>
                                        {colonnes.map((c) => c === "pause" ? null : (
                                            <th key={`h-${c.hour}`} className={`border border-slate-300 px-2 py-2 text-center text-[11px] font-bold whitespace-nowrap ${
                                                c.couvert === false ? "bg-slate-400 text-white/80" : "bg-slate-800 text-white"
                                            }`} style={{ minWidth: "78px" }}>
                                                {slotLabel(c)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.students as Student[]).map((st, idx) => {
                                        const total = totalAbsences(st.id);
                                        return (
                                            <tr key={st.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                                                <td className="border border-slate-300 px-2 py-2 text-center text-xs font-medium text-slate-400">
                                                    {idx + 1}
                                                </td>
                                                <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                                                    {st.firstName} {st.lastName}
                                                </td>
                                                {colonnes.map((c, i) => c === "pause" ? (
                                                    <td key={`pc-${i}`} className="border border-slate-300 bg-amber-50/50" />
                                                ) : (
                                                    <td key={`c-${st.id}-${c.hour}`} className={`border border-slate-300 px-2 py-1.5 text-center h-9 ${c.couvert === false ? "bg-slate-50/60" : ""}`}>
                                                        {estVierge || c.couvert === false ? null : (() => {
                                                            const m = marque(st.id, c.hour);
                                                            if (!m) return (
                                                                <span className="cell-mark inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-200">
                                                                    P
                                                                </span>
                                                            );
                                                            return (
                                                                <span
                                                                    className={`cell-mark inline-flex items-center justify-center min-w-[24px] h-6 px-1 rounded-md font-black text-xs border ${styleMarque(m.mark)}`}
                                                                    title={m.mark === "R" && m.minutes ? `${m.minutes} minutes de retard` : undefined}
                                                                >
                                                                    {m.mark === "R" && m.minutes ? `R${m.minutes}` : m.mark}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                ))}
                                                <td className="border border-slate-300 px-2 py-1.5 text-center">
                                                    {!estVierge && (
                                                        <span className={`font-black text-sm ${total > 0 ? "text-red-600" : "text-slate-300"}`}>
                                                            {total}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Légende + signature */}
                    <div className="mt-6 flex justify-between items-end gap-8">
                        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 text-emerald-600 font-bold text-[10px] border border-emerald-200">P</span>
                                Présent
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-100 text-red-700 font-black text-[10px] border border-red-300">A</span>
                                Absent
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-100 text-purple-700 font-black text-[10px] border border-purple-300">E</span>
                                Exclus
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-100 text-amber-700 font-black text-[10px] border border-amber-300">R</span>
                                Retard (minutes)
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 text-center shrink-0">
                            <p className="mb-12 font-medium">Signature du directeur / Cachet</p>
                            <div className="w-48 border-b border-slate-400" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}