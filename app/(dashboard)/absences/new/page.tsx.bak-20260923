"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Save, Users, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Student {
    id: number;
    firstName: string;
    lastName: string;
    classId?: number | null;
}
interface Classe {
    id: number;
    name: string;
    level: string;
    students?: Student[];
}
interface Teacher {
    id: number;
    name: string;
    subject?: {
        name: string;
    }
}

const STATUTS = [
    { cle: "present",   libelle: "Présent", actif: "bg-emerald-600 text-white border-emerald-600" },
    { cle: "absence",   libelle: "Absent",  actif: "bg-red-600 text-white border-red-600" },
    { cle: "exclusion", libelle: "Exclus",  actif: "bg-purple-600 text-white border-purple-600" },
    { cle: "retard",    libelle: "Retard",  actif: "bg-amber-500 text-white border-amber-500" },
];

const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

// La saisie se fait par heure pleine : 08:00-09:00, 09:00-10:00...
const CRENEAUX = HOURS.map((h) => {
    const fin = `${String(Number(h.slice(0, 2)) + 1).padStart(2, "0")}:00`;
    return { debut: h, fin, libelle: `${h} – ${fin}` };
});

// Date du jour au format AAAA-MM-JJ, en heure locale (toISOString donne l'heure UTC)
const todayLocal = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
};

export default function NewAbsencePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [classes, setClasses] = useState<Classe[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);

    // Statut de chaque élève : "present" | "absence" | "exclusion" | "retard"
    const [attendance, setAttendance] = useState<Record<number, string>>({});
    // Minutes de retard, quand le statut est "retard"
    const [lateMinutes, setLateMinutes] = useState<Record<number, string>>({});

    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [dateFilter, setDateFilter] = useState<string>(todayLocal());
    const [hourFilter, setHourFilter] = useState<string>("");
    const [hourEndFilter, setHourEndFilter] = useState<string>("");

    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
    const [teacherSubject, setTeacherSubject] = useState<string>("");
    const [allSchedules, setAllSchedules] = useState<any[]>([]);

    const getCookie = (name: string) => {
        if (typeof document === "undefined") return null;
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] ?? null;
    };

    useEffect(() => {
        const role = getCookie("user-role");
        const idStr = getCookie("user-id");
        setUserRole(role);
        setUserId(idStr);

        const fetchData = async () => {
            try {
                const isTeacher = role !== 'admin';

                const classesUrl = isTeacher && idStr ? `/api/classes/teacher/${idStr}` : '/api/classes';
                // Les élèves sont chargés séparément : la route des classes d'un
                // enseignant ne renvoie pas forcément la liste des élèves.
                const studentsUrl = isTeacher && idStr ? `/api/students?teacherId=${idStr}` : '/api/students';

                const [classesRes, studentsRes, teachersRes, schedulesRes] = await Promise.all([
                    fetch(classesUrl),
                    fetch(studentsUrl),
                    fetch(isTeacher && idStr ? `/api/teachers/${idStr}` : '/api/teachers'),
                    fetch('/api/schedule'),
                ]);

                if (classesRes.ok) {
                    const classesData = await classesRes.json();
                    setClasses(Array.isArray(classesData) ? classesData : []);
                }
                if (studentsRes.ok) {
                    const studentsData = await studentsRes.json();
                    setAllStudents(Array.isArray(studentsData) ? studentsData : []);
                }
                if (teachersRes.ok) {
                    const teachersData = await teachersRes.json();
                    const list = isTeacher ? (teachersData ? [teachersData] : []) : (Array.isArray(teachersData) ? teachersData : []);
                    setTeachers(list);

                    if (isTeacher && teachersData) {
                        setTeacherSubject(teachersData.subject?.name || "");
                        setSelectedTeacherId(Number(idStr));
                    }
                }
                if (schedulesRes.ok) {
                    const schedulesData = await schedulesRes.json();
                    setAllSchedules(Array.isArray(schedulesData) ? schedulesData : []);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    // Effect to automatically set hour based on schedule
    useEffect(() => {
        const tId = userRole !== 'admin' ? userId : selectedTeacherId;
        if (!selectedClassId || !tId || !allSchedules.length) {
            if (!hourFilter && allSchedules.length > 0) {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, '0');
                const cr = CRENEAUX.find(c => c.debut === `${hh}:00`);
                if (cr) {
                    setHourFilter(cr.debut);
                    setHourEndFilter(cr.fin);
                }
            }
            return;
        }

        const now = new Date();
        const selectedDate = new Date(dateFilter);
        const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
        const currentDay = days[selectedDate.getDay()];
        const currentTime = now.getHours() + now.getMinutes() / 60;

        const matchingSchedule = allSchedules.find(s =>
            String(s.teacherId) === String(tId) &&
            String(s.classId) === String(selectedClassId) &&
            s.day === currentDay &&
            (() => {
                if (!s.start) return false;
                const [h, m] = s.start.split(":").map(Number);
                const startTime = h + m / 60;
                return currentTime >= startTime && currentTime < (startTime + (s.duration || 1));
            })()
        );

        if (matchingSchedule) {
            // On ramène le créneau à l'heure pleine dans laquelle il commence
            const debut = `${matchingSchedule.start.slice(0, 2)}:00`;
            const cr = CRENEAUX.find(c => c.debut === debut);
            if (cr) {
                setHourFilter(cr.debut);
                setHourEndFilter(cr.fin);
            }
        } else {
            const hh = String(now.getHours()).padStart(2, '0');
            const cr = CRENEAUX.find(c => c.debut === `${hh}:00`);
            if (cr) {
                setHourFilter(cr.debut);
                setHourEndFilter(cr.fin);
            }
        }
    }, [selectedClassId, userRole, userId, allSchedules, dateFilter, selectedTeacherId]);

    // Effect to fetch existing absences when class, date, or hour change
    useEffect(() => {
        if (!selectedClassId || !dateFilter || !hourFilter) return;

        const fetchExistingAbsences = async () => {
            try {
                const res = await fetch(`/api/absences?classId=${selectedClassId}&date=${dateFilter}&hour=${hourFilter}`);
                if (res.ok) {
                    const existingAbsences = await res.json();
                    if (!Array.isArray(existingAbsences)) return;

                    const newAttendance: Record<number, string> = {};
                    const newLate: Record<number, string> = {};
                    students.forEach(s => {
                        newAttendance[s.id] = "present";
                    });

                    existingAbsences.forEach((a: any) => {
                        newAttendance[a.studentId] = a.status || "absence";
                        if (a.lateMinutes) newLate[a.studentId] = String(a.lateMinutes);
                    });

                    setAttendance(newAttendance);
                    setLateMinutes(newLate);
                }
            } catch (error) {
                console.error("Error fetching existing absences:", error);
            }
        };

        fetchExistingAbsences();
    }, [selectedClassId, dateFilter, hourFilter, students]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const classId = formData.get("classId");
        const teacherId = formData.get("teacherId");

        if (!hourFilter || !hourEndFilter) {
            alert("Sélectionnez la séance.");
            setIsLoading(false);
            return;
        }

        // Tout élève qui n'est pas "present" donne lieu à un enregistrement
        const absentStudents = students
            .filter(s => attendance[s.id] && attendance[s.id] !== "present")
            .map(s => ({
                id: s.id,
                status: attendance[s.id],
                lateMinutes: attendance[s.id] === "retard" && lateMinutes[s.id]
                    ? Number(lateMinutes[s.id])
                    : null,
            }));

        const retardSansDuree = absentStudents.find(
            (s: any) => s.status === "retard" && (!s.lateMinutes || s.lateMinutes <= 0)
        );
        if (retardSansDuree) {
            alert("Indiquez le nombre de minutes pour chaque retard.");
            setIsLoading(false);
            return;
        }

        if (absentStudents.length === 0) {
            if (!confirm("Tous les élèves sont marqués présents. Voulez-vous enregistrer la liste ainsi ?")) {
                setIsLoading(false);
                return;
            }
        }

        try {
            const res = await fetch("/api/absences/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    classId,
                    dateAbsence: dateFilter,
                    hour: hourFilter,
                    hourEnd: hourEndFilter,
                    teacherId,
                    absentStudents
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to sync absences");
            }

            router.push("/absences");
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Une erreur est survenue.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const classId = parseInt(e.target.value);
        setSelectedClassId(classId || null);

        if (!classId) {
            setStudents([]);
            setAttendance({});
            setLateMinutes({});
            return;
        }

        // Les élèves de la classe, pris dans la liste chargée au démarrage.
        // On complète avec ceux éventuellement fournis par la route des classes.
        const selectedClass = classes.find((c) => c.id === classId);
        const fromClasse = Array.isArray(selectedClass?.students) ? selectedClass!.students! : [];
        const fromListe = allStudents.filter((s) => Number(s.classId) === classId);

        const parId = new Map<number, Student>();
        [...fromListe, ...fromClasse].forEach((s) => {
            if (s && typeof s.id === "number") parId.set(s.id, s);
        });

        const sortedStudents = Array.from(parId.values()).sort((a, b) =>
            (a.firstName || "").localeCompare(b.firstName || "")
        );

        setStudents(sortedStudents);
        const initialAttendance: Record<number, string> = {};
        sortedStudents.forEach(s => {
            initialAttendance[s.id] = "present";
        });
        setAttendance(initialAttendance);
        setLateMinutes({});
    };

    const setStatus = (studentId: number, status: string) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
        if (status !== "retard") {
            setLateMinutes(prev => {
                const copie = { ...prev };
                delete copie[studentId];
                return copie;
            });
        }
    };

    return (
        <div className="space-y-6 mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/absences"
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Feuille d&apos;appel</h1>
                    <p className="text-slate-500 text-sm">Saisissez les absences de la classe.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        {/* Titre */}
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-500" />
                            Informations de la séance
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Prof */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Enseignant</label>
                                <select
                                    name="teacherId"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-70 disabled:bg-slate-100"
                                    value={selectedTeacherId ? String(selectedTeacherId) : ""}
                                    disabled={userRole !== 'admin'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedTeacherId(val ? Number(val) : null);
                                        const t = teachers.find(teacher => String(teacher.id) === val);
                                        setTeacherSubject(t?.subject?.name || "");
                                    }}
                                >
                                    <option value="">Sélectionner un enseignant...</option>
                                    {teachers.map((teacher) => {
                                        return (
                                            <option key={teacher.id} value={teacher.id}>
                                                {teacher.name}
                                            </option>
                                        )
                                    })}
                                </select>
                                <input
                                    type="hidden"
                                    name="teacherId"
                                    value={userRole !== 'admin' ? (userId || "") : ""}
                                    disabled={userRole === 'admin'}
                                />
                            </div>
                            {/* Matière */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Matière</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={teacherSubject}
                                    placeholder="Matière de l'enseignant"
                                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg outline-none text-sm text-slate-500 cursor-not-allowed"
                                />
                            </div>
                            {/* classe */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Classe</label>
                                <select
                                    name="classId"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                    onChange={handleChange}
                                >
                                    <option value="">Sélectionner une classe...</option>
                                    {classes.map((cls) => {
                                        const name = (cls.level === "1") ? "السابعة أساسي " + cls.name : (cls.level === "2") ? "الثامنة أساسي " + cls.name : (cls.level === "3") ? "التاسعة أساسي " + cls.name : ""
                                        return (
                                            <option key={cls.id} value={cls.id}>
                                                {name}
                                            </option>
                                        )
                                    })}
                                </select>
                            </div>
                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Date Absence</label>
                                <input
                                    type="date"
                                    name="dateAbsence"
                                    required
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                />
                            </div>
                            {/* séance */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Séance<span className="text-red-500">*</span></label>
                                <select
                                    name="hour"
                                    required
                                    value={hourFilter}
                                    onChange={(e) => {
                                        const debut = e.target.value;
                                        setHourFilter(debut);
                                        const cr = CRENEAUX.find(c => c.debut === debut);
                                        setHourEndFilter(cr ? cr.fin : "");
                                    }}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                >
                                    <option value="">Sélectionner la séance...</option>
                                    {CRENEAUX.map((c) => (
                                        <option key={c.debut} value={c.debut}>{c.libelle}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Classe choisie mais aucun élève */}
                        {selectedClassId && students.length === 0 && (
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-amber-800">Aucun élève dans cette classe</p>
                                        <p className="text-sm text-amber-700 mt-1">
                                            Vérifiez auprès de l&apos;administration que des élèves y sont bien inscrits.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Liste d'appel */}
                        {students.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-slate-900">
                                        Appel des élèves ({students.length})
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        Tous les élèves sont présents par défaut.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {students.map((s) => {
                                        const statut = attendance[s.id] || "present";
                                        return (
                                            <div
                                                key={s.id}
                                                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border transition-colors ${
                                                    statut === "absence"   ? "bg-red-50/50 border-red-200" :
                                                    statut === "exclusion" ? "bg-purple-50/50 border-purple-200" :
                                                    statut === "retard"    ? "bg-amber-50/50 border-amber-200" :
                                                                             "bg-slate-50 border-slate-200"
                                                }`}
                                            >
                                                <div className="flex-1 font-medium text-sm text-slate-800">
                                                    {s.firstName} {s.lastName}
                                                </div>

                                                {/* Minutes de retard */}
                                                {statut === "retard" && (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="240"
                                                            value={lateMinutes[s.id] || ""}
                                                            onChange={(e) => setLateMinutes(prev => ({ ...prev, [s.id]: e.target.value }))}
                                                            placeholder="min"
                                                            className="w-20 px-2 py-1.5 text-sm text-center bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/20"
                                                        />
                                                        <span className="text-xs font-medium text-amber-700">minutes</span>
                                                    </div>
                                                )}

                                                {/* Choix du statut */}
                                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                                    {STATUTS.map(st => (
                                                        <button
                                                            key={st.cle}
                                                            type="button"
                                                            onClick={() => setStatus(s.id, st.cle)}
                                                            className={`px-3 py-2 rounded-lg border text-[13px] font-medium transition-all ${
                                                                statut === st.cle
                                                                    ? st.actif
                                                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                                                            }`}
                                                        >
                                                            {st.libelle}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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