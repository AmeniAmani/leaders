"use client";

import { isoler } from "@/lib/bidi";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, Save, Users, AlertTriangle, Ticket, CalendarClock, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { comparerEleves } from "@/lib/eleves";
import { useRouter } from "next/navigation";
import { messageErreur, messageException } from "@/lib/erreur-api";

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

// Cours en cours renvoyé par /api/absences/creneau-actuel
interface CoursActuel {
    classId: number;
    subjectName: string | null;
    start: string;
    hour: string;
    hourEnd: string;
}

// État calculé d'un élève sur le créneau (voir lib/emploi-du-temps.ts)
type EtatAppel = "encore_absent" | "present_avec_billet" | "billet_retard";

// Billet d'entrée affecté à ce créneau : l'enseignant valide l'arrivée de l'élève
interface BilletCreneau {
    id: number;
    studentId: number;
    statut: string; // "en_attente" | "valide"
    traiteAt: string | null;
    traitePar: string | null;
}

const BADGES: Record<EtatAppel, { libelle: string; style: string }> = {
    encore_absent:       { libelle: "Encore absent",       style: "bg-red-100 text-red-700 border-red-200" },
    present_avec_billet: { libelle: "Présent avec billet", style: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    billet_retard:       { libelle: "Billet de retard",    style: "bg-amber-100 text-amber-700 border-amber-200" },
};

const parEleve = (liste: unknown): Record<number, BilletCreneau> =>
    Object.fromEntries((Array.isArray(liste) ? liste as BilletCreneau[] : []).map(b => [b.studentId, b]));

const heureDe = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

const libelleClasse = (cls?: { level: string; name: string }) =>
    !cls ? "" :
    cls.level === "1" ? "السابعة أساسي " + cls.name :
    cls.level === "2" ? "الثامنة أساسي " + cls.name :
    cls.level === "3" ? "التاسعة أساسي " + cls.name : "";

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
    // Administration : classes de l'enseignant choisi, et dernier enseignant demandé
    const [chargementClasses, setChargementClasses] = useState(false);
    const enseignantDemande = useRef<number | null>(null);

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

    // Cours en cours d'après l'emploi du temps (plusieurs possibles : groupes)
    const [coursActuels, setCoursActuels] = useState<CoursActuel[]>([]);
    // État de chaque élève sur ce créneau, et élèves dont la ligne ne peut plus changer
    const [etats, setEtats] = useState<Record<number, EtatAppel>>({});
    const [verrouilles, setVerrouilles] = useState<Set<number>>(new Set());
    // Billets d'entrée du créneau, par élève
    const [billets, setBillets] = useState<Record<number, BilletCreneau>>({});
    const [billetEnCours, setBilletEnCours] = useState<number | null>(null);

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

                const [classesRes, studentsRes, teachersRes, creneauRes] = await Promise.all([
                    // Administration : les classes arrivent avec le choix de l'enseignant
                    isTeacher ? fetch(classesUrl) : Promise.resolve(null),
                    fetch(studentsUrl),
                    fetch(isTeacher && idStr ? `/api/teachers/${idStr}` : '/api/teachers'),
                    // Lu à chaque ouverture : l'emploi du temps peut avoir changé
                    isTeacher ? fetch('/api/absences/creneau-actuel', { cache: 'no-store' }) : Promise.resolve(null),
                ]);

                let classesList: Classe[] = [];
                let studentsList: Student[] = [];
                if (classesRes && classesRes.ok) {
                    const classesData = await classesRes.json();
                    classesList = Array.isArray(classesData) ? classesData : [];
                    setClasses(classesList);
                }
                if (studentsRes.ok) {
                    const studentsData = await studentsRes.json();
                    studentsList = Array.isArray(studentsData) ? studentsData : [];
                    setAllStudents(studentsList);
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

                // Feuille d'appel pré-remplie avec le cours en cours
                const creneau = creneauRes && creneauRes.ok ? await creneauRes.json() : null;
                const cours: CoursActuel[] = Array.isArray(creneau?.cours) ? creneau.cours : [];
                setCoursActuels(cours);
                if (cours.length > 0) {
                    if (creneau.date) setDateFilter(creneau.date);
                    appliquerCours(cours[0], classesList, studentsList);
                } else {
                    // Hors cours : l'heure actuelle, à corriger si besoin
                    const cr = CRENEAUX.find(c => c.debut === `${String(new Date().getHours()).padStart(2, "0")}:00`);
                    if (cr) {
                        setHourFilter(cr.debut);
                        setHourEndFilter(cr.fin);
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
        // Chargement unique à l'ouverture de la feuille
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Effect to fetch existing absences when class, date, or hour change
    useEffect(() => {
        if (!selectedClassId || !dateFilter || !hourFilter) return;

        const fetchExistingAbsences = async () => {
            try {
                const res = await fetch(
                    `/api/absences/appel?classId=${selectedClassId}&date=${dateFilter}&hour=${hourFilter}`,
                    { cache: 'no-store' }
                );
                if (res.ok) {
                    const data = await res.json();
                    const existingAbsences = Array.isArray(data.absences) ? data.absences : [];
                    const nouveauxEtats: Record<number, EtatAppel> = data.etats || {};

                    const newAttendance: Record<number, string> = {};
                    const newLate: Record<number, string> = {};
                    const bloques = new Set<number>();
                    students.forEach(s => {
                        // Absent sur un créneau précédent, sans billet : pré-coché absent
                        newAttendance[s.id] = nouveauxEtats[s.id] === "encore_absent" ? "absence" : "present";
                    });

                    existingAbsences.forEach((a: any) => {
                        newAttendance[a.studentId] = a.status || "absence";
                        if (a.lateMinutes) newLate[a.studentId] = String(a.lateMinutes);
                        if (a.billet) bloques.add(a.studentId);
                    });

                    // Arrivé avec un billet d'entrée sur ce créneau
                    Object.entries(nouveauxEtats).forEach(([id, etat]) => {
                        if (etat === "present_avec_billet") {
                            newAttendance[Number(id)] = "present";
                            bloques.add(Number(id));
                        }
                    });

                    setAttendance(newAttendance);
                    setLateMinutes(newLate);
                    setEtats(nouveauxEtats);
                    setVerrouilles(bloques);
                    setBillets(parEleve(data.billets));
                }
            } catch (error) {
                console.error("Error fetching existing absences:", error);
            }
        };

        fetchExistingAbsences();
    }, [selectedClassId, dateFilter, hourFilter, students]);

    // Élève signalé « non arrivé » : le billet ne compte plus, il redevient absent sur ce créneau.
    // Seule sa ligne change, pour ne pas perdre l'appel en cours de saisie.
    const eleveNonArrive = useCallback((studentId: number) => {
        setEtats(prev => ({ ...prev, [studentId]: "encore_absent" }));
        setAttendance(prev => ({ ...prev, [studentId]: "absence" }));
        setVerrouilles(prev => {
            const copie = new Set(prev);
            copie.delete(studentId);
            return copie;
        });
        setBillets(prev => {
            const copie = { ...prev };
            delete copie[studentId];
            return copie;
        });
    }, []);

    // Billet traité depuis la cloche : on relit les billets du créneau
    const rechargerBillets = useCallback(async () => {
        if (!selectedClassId || !dateFilter || !hourFilter) return;
        try {
            const res = await fetch(
                `/api/absences/appel?classId=${selectedClassId}&date=${dateFilter}&hour=${hourFilter}`,
                { cache: 'no-store' }
            );
            if (!res.ok) return;
            const nouveaux = parEleve((await res.json()).billets);
            // Billet disparu : signalé « non arrivé »
            Object.keys(billets).map(Number).filter(id => !nouveaux[id]).forEach(eleveNonArrive);
            setBillets(nouveaux);
        } catch (error) {
            console.error("Error refreshing billets:", error);
        }
    }, [selectedClassId, dateFilter, hourFilter, billets, eleveNonArrive]);

    useEffect(() => {
        window.addEventListener("billets:refresh", rechargerBillets);
        return () => window.removeEventListener("billets:refresh", rechargerBillets);
    }, [rechargerBillets]);

    const traiterBillet = async (student: Student, arrive: boolean) => {
        const billet = billets[student.id];
        if (!billet) return;
        if (!arrive && !window.confirm(
            `Signaler que ${student.firstName} ${student.lastName} n'est pas arrivé ?\n\n` +
            `L'administration en sera informée et l'élève sera marqué absent : pensez à enregistrer l'appel.`
        )) return;

        setBilletEnCours(student.id);
        try {
            const res = await fetch("/api/billets/valider", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ billetId: billet.id, arrive }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Erreur lors de la validation du billet");
                rechargerBillets();
                return;
            }
            if (arrive) {
                setBillets(prev => ({ ...prev, [student.id]: { ...billet, ...data.billet } }));
            } else {
                eleveNonArrive(student.id);
            }
            // La cloche se met à jour
            window.dispatchEvent(new Event("admin-alerts:refresh"));
        } catch (error) {
            console.error(error);
            alert("Erreur lors de la validation du billet");
        } finally {
            setBilletEnCours(null);
        }
    };

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
            (s: any) => s.status === "retard" &&
                (!Number.isInteger(s.lateMinutes) || s.lateMinutes < 1 || s.lateMinutes > 240)
        );
        if (retardSansDuree) {
            alert("Indiquez un nombre entier de minutes (1 à 240) pour chaque retard.");
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

            if (!res.ok) throw new Error(await messageErreur(res));

            router.push("/absences");
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(messageException(error));
        } finally {
            setIsLoading(false);
        }
    };

    // Administration : seules les classes affectées à l'enseignant choisi sont proposées
    const choisirEnseignant = async (teacherId: number | null) => {
        enseignantDemande.current = teacherId;
        if (!teacherId) {
            setClasses([]);
            choisirClasse(0, []);
            return;
        }
        setChargementClasses(true);
        try {
            const res = await fetch(`/api/classes/teacher/${teacherId}`, { cache: 'no-store' });
            const data = res.ok ? await res.json() : [];
            // Un autre enseignant a été choisi entre-temps
            if (enseignantDemande.current !== teacherId) return;
            const liste: Classe[] = Array.isArray(data) ? data : [];
            setClasses(liste);
            // La classe choisie n'est pas la sienne : on la retire
            if (selectedClassId && !liste.some(c => c.id === selectedClassId)) {
                choisirClasse(0, liste);
            }
        } catch (error) {
            console.error("Error fetching teacher classes:", error);
        } finally {
            if (enseignantDemande.current === teacherId) setChargementClasses(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        choisirClasse(parseInt(e.target.value));
    };

    // Pré-remplissage : classe, séance et matière du cours de l'emploi du temps
    const appliquerCours = (cours: CoursActuel, classesList = classes, studentsList = allStudents) => {
        choisirClasse(cours.classId, classesList, studentsList);
        const cr = CRENEAUX.find(c => c.debut === cours.hour);
        if (cr) {
            setHourFilter(cr.debut);
            setHourEndFilter(cr.fin);
        }
        if (cours.subjectName) setTeacherSubject(cours.subjectName);
    };

    const choisirClasse = (classId: number, classesList = classes, studentsList = allStudents) => {
        setSelectedClassId(classId || null);
        setEtats({});
        setVerrouilles(new Set());
        setBillets({});

        if (!classId) {
            setStudents([]);
            setAttendance({});
            setLateMinutes({});
            return;
        }

        // Les élèves de la classe, pris dans la liste chargée au démarrage.
        // On complète avec ceux éventuellement fournis par la route des classes.
        const selectedClass = classesList.find((c) => c.id === classId);
        const fromClasse = Array.isArray(selectedClass?.students) ? selectedClass!.students! : [];
        const fromListe = studentsList.filter((s) => Number(s.classId) === classId);

        const parId = new Map<number, Student>();
        [...fromListe, ...fromClasse].forEach((s) => {
            if (s && typeof s.id === "number") parId.set(s.id, s);
        });

        // Par nom, puis prénom
        const sortedStudents = Array.from(parId.values()).sort(comparerEleves);

        setStudents(sortedStudents);
        const initialAttendance: Record<number, string> = {};
        sortedStudents.forEach(s => {
            initialAttendance[s.id] = "present";
        });
        setAttendance(initialAttendance);
        setLateMinutes({});
    };

    const setStatus = (studentId: number, status: string) => {
        if (verrouilles.has(studentId)) return;
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

                        {/* Cours en cours d'après l'emploi du temps */}
                        {userRole !== 'admin' && (
                            <div className="mb-6 flex flex-wrap items-center gap-2 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-sm text-indigo-900">
                                <CalendarClock className="w-4 h-4 text-indigo-500 shrink-0" />
                                {coursActuels.length === 0 ? (
                                    <span>Aucun cours à l&apos;emploi du temps en ce moment : choisissez la classe et la séance.</span>
                                ) : coursActuels.length === 1 ? (
                                    <span>
                                        Pré-rempli d&apos;après votre emploi du temps : <bdi>{libelleClasse(classes.find(c => c.id === coursActuels[0].classId))}</bdi>
                                        {coursActuels[0].subjectName && <> — <bdi>{coursActuels[0].subjectName}</bdi></>}, {coursActuels[0].hour} – {coursActuels[0].hourEnd}.
                                    </span>
                                ) : (
                                    <>
                                        <span>Vous avez plusieurs cours en ce moment :</span>
                                        {coursActuels.map(c => (
                                            <button
                                                key={`${c.classId}-${c.subjectName}`}
                                                type="button"
                                                onClick={() => appliquerCours(c)}
                                                className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                                                    selectedClassId === c.classId
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-white border-indigo-200 hover:border-indigo-400"
                                                }`}
                                            >
                                                {/* Classe et matière sur deux lignes, chacune dans son sens d'écriture */}
                                                <span dir="auto" className="block">{libelleClasse(classes.find(cl => cl.id === c.classId))}</span>
                                                {c.subjectName && <span dir="auto" className="block">{c.subjectName}</span>}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Prof */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Enseignant<span className="text-red-500">*</span></label>
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
                                        choisirEnseignant(val ? Number(val) : null);
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
                                <label className="text-sm font-medium text-slate-700">Classe<span className="text-red-500">*</span></label>
                                <select
                                    name="classId"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm disabled:opacity-70 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    value={selectedClassId ? String(selectedClassId) : ""}
                                    onChange={handleChange}
                                    disabled={userRole === 'admin' && (!selectedTeacherId || chargementClasses)}
                                >
                                    <option value="">
                                        {userRole === 'admin' && !selectedTeacherId ? "Choisissez d'abord l'enseignant..." :
                                         chargementClasses ? "Chargement des classes..." :
                                         "Sélectionner une classe..."}
                                    </option>
                                    {classes.map((cls) => {
                                        const name = libelleClasse(cls)
                                        return (
                                            <option key={cls.id} value={cls.id}>
                                                {isoler(name)}
                                            </option>
                                        )
                                    })}
                                </select>
                                {userRole === 'admin' && selectedTeacherId && !chargementClasses && classes.length === 0 && (
                                    <p className="text-xs text-amber-700">Aucune classe affectée à cet enseignant.</p>
                                )}
                            </div>
                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Date Absence<span className="text-red-500">*</span></label>
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
                                                <div className="flex-1 font-medium text-sm text-slate-800 flex flex-wrap items-center gap-2">
                                                    {s.firstName} {s.lastName}
                                                    {etats[s.id] && (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${BADGES[etats[s.id]].style}`}>
                                                            {etats[s.id] !== "encore_absent" && <Ticket className="w-3 h-3" />}
                                                            {BADGES[etats[s.id]].libelle}
                                                        </span>
                                                    )}
                                                    {/* Billet d'entrée : l'élève s'est-il présenté ? */}
                                                    {billets[s.id]?.statut === "valide" && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                                                            <Check className="w-3 h-3" />
                                                            Arrivée validée{billets[s.id].traiteAt ? ` à ${heureDe(billets[s.id].traiteAt)}` : ""}
                                                        </span>
                                                    )}
                                                    {billets[s.id]?.statut === "en_attente" && (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => traiterBillet(s, true)}
                                                                disabled={billetEnCours === s.id}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50 whitespace-nowrap"
                                                            >
                                                                {billetEnCours === s.id
                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <Check className="w-3.5 h-3.5" />}
                                                                Valider
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => traiterBillet(s, false)}
                                                                disabled={billetEnCours === s.id}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                Non arrivé
                                                            </button>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Minutes de retard */}
                                                {statut === "retard" && (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="240"
                                                            step="1"
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
                                                            disabled={verrouilles.has(s.id)}
                                                            title={verrouilles.has(s.id) ? "Billet émis par l'administration : non modifiable" : undefined}
                                                            className={`px-3 py-2 rounded-lg border text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
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