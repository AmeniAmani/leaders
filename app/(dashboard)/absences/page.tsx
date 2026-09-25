"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Filter, Send, CheckCircle2, Clock, Loader2, User, User2, GraduationCap, UserX, X, Save, CalendarDays, FileText, Trash2, BellRing, Check, ChevronDown, RefreshCw, Ticket, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Absence {
    id: number;
    studentId: number;
    classId: number;
    dateAbsence: string;
    hour: string;
    hourEnd: string | null;
    status: string | null;
    lateMinutes: number | null;
    validated: boolean | null;
    validatedAt: string | null;
    // Billet émis depuis cette ligne
    billet: {
        id: number;
        type: string;
        hour: string | null;
        hourEnd: string | null;
        createdAt: string;
        // Billet d'entrée : arrivée validée ou non par l'enseignant du cours
        statut: string;
        traiteAt: string | null;
        traitePar: string | null;
        notifications: { teacher: { name: string | null } | null }[];
    } | null;
    // Envoi au parent de la journée d'absence
    parentNotice: { id: number; sentAt: string } | null;
    // Enseignant qui a fait le signalement, et matière du cours d'après l'emploi du temps
    teacher: { id: number; name: string | null } | null;
    matiere: string | null;
    student: {
        id: number;
        firstName: string;
        lastName: string;
    } | null;
    classe: {
        id: number;
        level: string;
        name: string;
    } | null;
}

// Date du jour en heure locale (toISOString donne l'heure UTC)
const todayLocal = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
};

// Une date de la base ramenée au format AAAA-MM-JJ local
const jourDe = (valeur: string) => {
    const d = new Date(valeur);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
};

// Libellé du type de signalement
const libelleType = (a: { status: string | null; lateMinutes: number | null }) =>
    a.status === "exclusion" ? "exclusion"
    : a.status === "retard" ? (a.lateMinutes ? `retard de ${a.lateMinutes} min` : "retard")
    : "absence";

const HOURS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];

const classLabel = (c?: { level: string; name: string } | null) => {
    if (!c) return "";
    const prefix =
        c.level === "1" ? "السابعة أساسي " :
        c.level === "2" ? "الثامنة أساسي " :
        c.level === "3" ? "التاسعة أساسي " : "";
    return prefix + (c.name || "");
};

interface TeacherAbsence {
    id: number;
    dateStart: string;
    dateEnd: string;
    hourStart: string | null;
    hourEnd: string | null;
    reason: string | null;
    notifiedAt: string | null;
    teacher: { id: number; name: string | null; subject?: { name: string } | null } | null;
    classes: { id: number; name: string; level: string }[];
}

export default function AbsencesPage() {
    const [tab, setTab] = useState<"students" | "teachers">("students");
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [teacherAbsences, setTeacherAbsences] = useState<TeacherAbsence[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);

    // Formulaire de déclaration d'absence enseignant
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formTeacherId, setFormTeacherId] = useState("");
    const [formStart, setFormStart] = useState("");
    const [formEnd, setFormEnd] = useState("");
    const [formReason, setFormReason] = useState("");
    const [formClassIds, setFormClassIds] = useState<number[]>([]);
    const [formAllDay, setFormAllDay] = useState(true);
    const [formHourStart, setFormHourStart] = useState("");
    const [formHourEnd, setFormHourEnd] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedClass, setSelectedClass] = useState(0);
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent">("all");
    const [classes, setClasses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [billetId, setBilletId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [menuOuvert, setMenuOuvert] = useState<number | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [changingId, setChangingId] = useState<number | null>(null);
    const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
    // Nombre de signalements déjà acquittés par l'administration.
    // Le rappel ne revient que si ce nombre augmente.
    const [pendingVus, setPendingVus] = useState<number | null>(null);
    // On arrive toujours sur la journée en cours
    const [dateFilter, setDateFilter] = useState<string>(todayLocal());

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
    const isAdmin = role === 'admin';

    useEffect(() => {
        fetchData();
        try {
            const memo = localStorage.getItem("absences-pending-vus");
            if (memo !== null) setPendingVus(Number(memo));
        } catch {
            // navigation privée ou stockage indisponible : le rappel restera visible
        }
    }, []);

    const fetchData = async () => {
        try {
            const userRole = getCookie("user-role");
            const id = getCookie("user-id");
            const absencesUrl = (userRole !== 'admin' && id) ? `/api/absences?teacherId=${id}` : '/api/absences';


            const [absencesRes, classesRes] = await Promise.all([
                fetch(absencesUrl),
                fetch('/api/classes'),
            ]);

            if (absencesRes.ok) {
                const absencesData = await absencesRes.json();
                setAbsences(Array.isArray(absencesData) ? absencesData : []);
            }
            if (classesRes.ok) {
                const classesData = await classesRes.json();
                setClasses(Array.isArray(classesData) ? classesData : []);
            }

            // Alertes en attente d'acquittement, administration uniquement
            if (userRole === 'admin') {
                const alertsRes = await fetch('/api/admin-alerts');
                if (alertsRes.ok) {
                    const aData = await alertsRes.json();
                    setAlerts(Array.isArray(aData) ? aData : []);
                }
            }

            // Onglet "Absences enseignants" : réservé à l'administration
            if (userRole === 'admin') {
                const [taRes, teachersRes] = await Promise.all([
                    fetch('/api/teacher-absences'),
                    fetch('/api/teachers'),
                ]);
                if (taRes.ok) {
                    const taData = await taRes.json();
                    setTeacherAbsences(Array.isArray(taData) ? taData : []);
                }
                if (teachersRes.ok) {
                    const tData = await teachersRes.json();
                    setTeachers(Array.isArray(tData) ? tData : []);
                }
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Rafraîchissement silencieux : pas d'indicateur de chargement, pas de
    // remise à zéro des filtres. Seules les données changent.
    const rafraichir = async () => {
        try {
            const userRole = getCookie("user-role");
            const id = getCookie("user-id");
            const absencesUrl = (userRole !== 'admin' && id) ? `/api/absences?teacherId=${id}` : '/api/absences';

            const absencesRes = await fetch(absencesUrl);
            if (absencesRes.ok) {
                const data = await absencesRes.json();
                setAbsences(Array.isArray(data) ? data : []);
            }

            if (userRole === 'admin') {
                const alertsRes = await fetch('/api/admin-alerts');
                if (alertsRes.ok) {
                    const aData = await alertsRes.json();
                    setAlerts(Array.isArray(aData) ? aData : []);
                }

                const taRes = await fetch('/api/teacher-absences');
                if (taRes.ok) {
                    const taData = await taRes.json();
                    setTeacherAbsences(Array.isArray(taData) ? taData : []);
                }
            }

            setDerniereMaj(new Date());
        } catch (error) {
            // Une actualisation ratée n'a pas à interrompre l'utilisateur :
            // la suivante aura lieu dans 30 secondes.
            console.error("Actualisation impossible", error);
        }
    };

    // Actualisation automatique toutes les 30 secondes.
    // Mise en pause quand l'onglet n'est pas visible.
    useEffect(() => {
        const timer = setInterval(() => {
            if (typeof document !== "undefined" && document.visibilityState === "visible") {
                rafraichir();
            }
        }, 30000);

        const onRetour = () => {
            if (document.visibilityState === "visible") rafraichir();
        };
        document.addEventListener("visibilitychange", onRetour);

        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onRetour);
        };
    }, []);

    // Classes rattachées à l'enseignant sélectionné dans le formulaire
    const formTeacherClasses = formTeacherId
        ? classes.filter((c: any) =>
            c.teachers?.some((t: any) => String(t.id) === formTeacherId)
        )
        : [];

    // Changer d'enseignant remet à zéro les classes cochées
    const handleFormTeacherChange = (value: string) => {
        setFormTeacherId(value);
        setFormClassIds([]);
    };

    const toggleFormClass = (id: number) => {
        setFormClassIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const resetForm = () => {
        setFormTeacherId("");
        setFormStart("");
        setFormEnd("");
        setFormReason("");
        setFormClassIds([]);
        setFormAllDay(true);
        setFormHourStart("");
        setFormHourEnd("");
    };

    // Enregistrer l'absence d'un enseignant et prévenir les parents
    const handleSaveTeacherAbsence = async () => {
        if (!formTeacherId) { alert("Sélectionnez un enseignant."); return; }
        if (!formStart) { alert("Indiquez la date de l'absence."); return; }
        if (formAllDay && !formEnd) { alert("Indiquez la date de fin."); return; }
        if (!formAllDay) {
            if (!formHourStart || !formHourEnd) { alert("Indiquez les heures d'absence."); return; }
            if (formHourEnd <= formHourStart) { alert("L'heure de fin doit être postérieure à l'heure de début."); return; }
        }
        if (formClassIds.length === 0) { alert("Sélectionnez au moins une classe."); return; }

        const t = teachers.find(x => String(x.id) === formTeacherId);
        const nbEleves = formTeacherClasses
            .filter((c: any) => formClassIds.includes(c.id))
            .reduce((n, c) => n + (c.students?.length || 0), 0);

        const periodeTexte = formAllDay
            ? (formStart === formEnd ? `le ${formStart}` : `du ${formStart} au ${formEnd}`)
            : `le ${formStart} de ${formHourStart} à ${formHourEnd}`;

        if (!window.confirm(
            `Déclarer ${t?.name || "cet enseignant"} absent(e) ${periodeTexte} ?\n\n` +
            `Les parents des ${formClassIds.length} classe(s) sélectionnée(s) seront prévenus immédiatement` +
            (nbEleves > 0 ? ` (${nbEleves} élève(s) concerné(s)).` : ".") +
            `\n\nCette action est définitive : la notification ne pourra pas être rappelée.`
        )) return;

        setIsSaving(true);
        try {
            const res = await fetch('/api/teacher-absences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId: Number(formTeacherId),
                    dateStart: formStart,
                    dateEnd: formAllDay ? formEnd : formStart,
                    hourStart: formAllDay ? null : formHourStart,
                    hourEnd: formAllDay ? null : formHourEnd,
                    reason: formReason || null,
                    classIds: formClassIds,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de l'enregistrement");

            setTeacherAbsences(prev => [data.absence, ...prev]);
            setIsFormOpen(false);
            resetForm();
            alert(`Absence enregistrée. ${data.notifiedParents} parent(s) prévenu(s).`);
        } catch (err: any) {
            console.error(err);
            alert(err?.message || "Une erreur est survenue.");
        } finally {
            setIsSaving(false);
        }
    };

    // Envoyer l'absence au parent (administration uniquement)
    const handleSend = async (absence: Absence) => {
        const nom = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : "cet élève";
        const date = absence.dateAbsence
            ? new Date(absence.dateAbsence).toLocaleDateString("fr-FR")
            : "";

        const creneau = absence.hourEnd ? `de ${absence.hour} à ${absence.hourEnd}` : `à ${absence.hour}`;

        const question = (absence.status || "absence") === "absence"
            ? `Envoyer au parent de ${nom} la notification d'absence du ${date} ?\n\n` +
              `Une seule notification est envoyée pour toute la journée : les autres absences de ce jour y seront rattachées.`
            : `Envoyer au parent de ${nom} la notification de ${libelleType(absence)} du ${date} ${creneau} ?`;

        if (!window.confirm(
            `${question}\n\nCette action est définitive : la notification ne pourra pas être rappelée.`
        )) return;

        setSendingId(absence.id);
        try {
            const res = await fetch('/api/absences/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ absenceId: absence.id }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");
            if (data.dejaPrevenu) {
                alert(`Le parent de ${nom} a déjà été prévenu de son absence ce jour-là : aucune nouvelle notification n'a été envoyée.`);
            }

            setAbsences(prev => prev.map(a =>
                a.id === absence.id
                    ? { ...a, validated: true, validatedAt: new Date().toISOString() }
                    : a
            ));

            // L'alerte du créneau a pu changer : actualiser la page et la cloche
            rafraichir();
            window.dispatchEvent(new Event("admin-alerts:refresh"));
        } catch (err: any) {
            console.error(err);
            alert(err?.message || "Erreur lors de l'envoi au parent");
        } finally {
            setSendingId(null);
        }
    };

    // Émettre un billet : d'entrée pour une absence, de retard pour un retard
    const handleBillet = async (absence: Absence) => {
        const nom = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : "cet élève";
        const libelle = absence.status === "retard" ? "un billet de retard" : "un billet d'entrée";

        if (!window.confirm(
            `Émettre ${libelle} pour ${nom} ?\n\n` +
            `L'enseignant concerné, d'après l'emploi du temps, en sera notifié. Rien n'est envoyé au parent.`
        )) return;

        setBilletId(absence.id);
        try {
            const res = await fetch('/api/billets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ absenceId: absence.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de l'émission du billet");

            const profs = (data.destinataires || []).join(", ");
            const heure = data.billet?.hour;
            const message =
                data.situation === "prochain" ? (profs
                    ? `Billet transmis pour le prochain cours (${heure}) à ${profs}, qui validera l'arrivée de l'élève.`
                    : `Billet enregistré pour le prochain cours (${heure}) : aucun enseignant trouvé sur ce créneau.`) :
                data.situation === "aucun_cours" ? "Plus aucun cours pour cette classe aujourd'hui : le billet est enregistré, aucun enseignant n'a été notifié." :
                data.situation === "regularisation" ? "Signalement d'un jour passé : le billet est enregistré, aucun enseignant n'a été notifié." :
                profs ? `Billet transmis à ${profs}.` : "Billet enregistré : aucun enseignant trouvé sur ce créneau.";
            alert(message);

            rafraichir();
        } catch (err) {
            console.error(err);
            alert(err instanceof Error && err.message ? err.message : "Erreur lors de l'émission du billet");
        } finally {
            setBilletId(null);
        }
    };

    // Acquitter une alerte : elle disparaît de la liste
    const handleAckAlert = async (alertId: number) => {
        try {
            const res = await fetch('/api/admin-alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId }),
            });
            if (!res.ok) throw new Error();
            setAlerts(prev => prev.filter(a => a.id !== alertId));
            window.dispatchEvent(new Event("admin-alerts:refresh"));
        } catch {
            alert("Impossible de masquer cette alerte.");
        }
    };

    // Alerte d'absence : afficher les signalements du créneau concerné.
    // La clé est de la forme absence:CLASSE:AAAA-MM-JJ:HH:MM
    const afficherCreneau = (type: string) => {
        const parties = type.split(":");
        setDateFilter(parties[2]);
        setSelectedClass(Number(parties[1]));
        setStatusFilter("pending");
        setSearchTerm("");
    };

    // Modification du type d'un signalement par l'enseignant
    const handleChangeStatus = async (absence: Absence, nouveauStatut: string) => {
        setMenuOuvert(null);

        const nom = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : "cet élève";

        // "Présent" revient à retirer le signalement
        if (nouveauStatut === "present") {
            await handleDelete(absence);
            return;
        }

        let minutes: number | null = null;
        if (nouveauStatut === "retard") {
            const saisie = window.prompt(
                `Combien de minutes de retard pour ${nom} ?`,
                absence.lateMinutes ? String(absence.lateMinutes) : "10"
            );
            if (saisie === null) return;
            minutes = Number(saisie);
            if (!minutes || minutes <= 0) {
                alert("Indiquez un nombre de minutes valide.");
                return;
            }
        }

        const avertissement = absence.validated === true
            ? `\n\nAttention : ce signalement a déjà été transmis au parent. La notification déjà envoyée ne sera pas corrigée, et l'administration en sera informée.`
            : `\n\nL'administration en sera informée.`;

        const libelleNouveau =
            nouveauStatut === "exclusion" ? "exclusion" :
            nouveauStatut === "retard" ? `retard de ${minutes} min` : "absence";

        if (!window.confirm(`Modifier le signalement de ${nom} en « ${libelleNouveau} » ?${avertissement}`)) return;

        setChangingId(absence.id);
        try {
            const res = await fetch('/api/absences/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ absenceId: absence.id, status: nouveauStatut, lateMinutes: minutes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de la modification");

            setAbsences(prev => prev.map(a =>
                a.id === absence.id
                    ? { ...a, status: nouveauStatut, lateMinutes: minutes }
                    : a
            ));
        } catch (err: any) {
            console.error(err);
            alert(err?.message || "Erreur lors de la modification");
        } finally {
            setChangingId(null);
        }
    };

    // Suppression d'une absence par l'enseignant qui l'a saisie
    const handleDelete = async (absence: Absence) => {
        const nom = absence.student
            ? `${absence.student.firstName || ''} ${absence.student.lastName || ''}`.trim()
            : "cet élève";
        const date = absence.dateAbsence
            ? new Date(absence.dateAbsence).toLocaleDateString("fr-FR")
            : "";

        const avertissement = absence.validated === true
            ? `\n\nAttention : ce signalement a déjà été transmis au parent. ` +
              `La supprimer ne retirera pas la notification déjà envoyée, et l'administration en sera informée.`
            : `\n\nL'administration en sera informée.`;
        const avertissementBillet = absence.billet
            ? `\n\n${absence.billet.type === "retard" ? "Un billet de retard" : "Un billet d'entrée"} a été émis pour ce signalement : ` +
              `il sera annulé, et les enseignants qui l'ont reçu n'en seront plus notifiés.`
            : "";

        if (!window.confirm(`Supprimer le signalement (${libelleType(absence)}) de ${nom} du ${date} ?${avertissementBillet}${avertissement}`)) return;

        setDeletingId(absence.id);
        try {
            const res = await fetch('/api/absences/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ absenceId: absence.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");

            setAbsences(prev => prev.filter(a => a.id !== absence.id));

            // L'alerte du créneau a pu changer : actualiser la page et la cloche
            rafraichir();
            window.dispatchEvent(new Event("admin-alerts:refresh"));
        } catch (err: any) {
            console.error(err);
            alert(err?.message || "Erreur lors de la suppression");
        } finally {
            setDeletingId(null);
        }
    };

    const filteredabsences = absences.filter(absence => {
        const matchesSearch = `${absence.student?.firstName || ''} ${absence.student?.lastName || ''}`
            .toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = selectedClass !== 0 ? absence.classId === selectedClass : true;
        const matchesStatus =
            statusFilter === "all" ? true :
            statusFilter === "sent" ? absence.validated === true :
            absence.validated !== true;
        const matchesDate = dateFilter
            ? (absence.dateAbsence ? jourDe(absence.dateAbsence) === dateFilter : false)
            : true;
        return matchesSearch && matchesClass && matchesStatus && matchesDate;
    });

    const pendingCount = absences.filter(a => a.validated !== true).length;
    // Ce qui est arrivé depuis le dernier acquittement
    const nouveauxCount = pendingVus === null ? pendingCount : Math.max(0, pendingCount - pendingVus);

    // ----- Morceaux d'une ligne de la table -----

    // Type de signalement ; l'enseignant peut le modifier depuis un menu
    // Billet émis depuis ce signalement
    const mentionBillet = (absence: Absence) => absence.billet && (
                                                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                                        <Ticket className="w-3 h-3" />
                                                        {absence.billet.type === "retard" ? "Billet de retard" : "Billet d'entrée"}
                                                        {absence.billet.hour ? ` (cours de ${absence.billet.hour})` : ""}
                                                        {` à ${new Date(absence.billet.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                                                        {absence.billet.notifications.length > 0 &&
                                                            ` — ${absence.billet.notifications.map(n => n.teacher?.name).filter(Boolean).join(", ")}`}
                                                        {absence.billet.type === "entree" && absence.billet.hour && (
                                                            absence.billet.statut === "en_attente"
                                                                ? <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">en attente de l&apos;élève</span>
                                                            : absence.billet.statut === "non_arrive"
                                                                ? <span className="ml-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">non arrivé{absence.billet.traitePar ? ` (${absence.billet.traitePar})` : ""}</span>
                                                            // Sans enseignant destinataire, rien n'était à valider
                                                            : absence.billet.notifications.length === 0
                                                                ? null
                                                                : <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    arrivée validée{absence.billet.traitePar ? ` par ${absence.billet.traitePar}` : ""}
                                                                    {absence.billet.traiteAt ? ` à ${new Date(absence.billet.traiteAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                                                                  </span>
                                                        )}
                                                    </div>
                                                );

    const celluleType = (absence: Absence) => {
        const mentionBilletLigne = mentionBillet(absence);
                                                const style =
                                                    absence.status === "exclusion" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                                    absence.status === "retard" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                                  "bg-red-50 text-red-700 border-red-200";
                                                const texte =
                                                    absence.status === "exclusion" ? "Exclus" :
                                                    absence.status === "retard" ? `Retard${absence.lateMinutes ? ` ${absence.lateMinutes} min` : ""}` :
                                                                                  "Absent";

                                                // L'administration ne modifie pas : elle envoie ou non

                                                if (isAdmin) {
                                                    return (
                                                        <div>
                                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${style}`}>
                                                                {texte}
                                                            </span>
                                                            {mentionBilletLigne && <div>{mentionBilletLigne}</div>}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="relative inline-block">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                if (menuOuvert === absence.id) { setMenuOuvert(null); return; }
                                                                const r = e.currentTarget.getBoundingClientRect();
                                                                // Le menu s'ouvre vers le haut s'il manque de place en bas
                                                                const hauteurMenu = 170;
                                                                const versLeHaut = r.bottom + hauteurMenu > window.innerHeight;
                                                                setMenuPos({
                                                                    top: versLeHaut ? r.top - hauteurMenu - 4 : r.bottom + 4,
                                                                    left: r.left,
                                                                });
                                                                setMenuOuvert(absence.id);
                                                            }}
                                                            disabled={changingId === absence.id || !!absence.billet}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 whitespace-nowrap hover:brightness-95 transition-all disabled:opacity-50 ${style}`}
                                                            title="Modifier le type"
                                                        >
                                                            {changingId === absence.id
                                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                : texte}
                                                            <ChevronDown className="w-3 h-3 opacity-60" />
                                                        </button>

                                                        {menuOuvert === absence.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-10"
                                                                    onClick={() => setMenuOuvert(null)}
                                                                />
                                                                <div
                                                                    className="fixed z-20 w-40 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
                                                                    style={{ top: menuPos.top, left: menuPos.left }}
                                                                >
                                                                    {[
                                                                        { cle: "present",   libelle: "Présent", couleur: "text-emerald-700 hover:bg-emerald-50" },
                                                                        { cle: "absence",   libelle: "Absent",  couleur: "text-red-700 hover:bg-red-50" },
                                                                        { cle: "exclusion", libelle: "Exclus",  couleur: "text-purple-700 hover:bg-purple-50" },
                                                                        { cle: "retard",    libelle: "Retard",  couleur: "text-amber-700 hover:bg-amber-50" },
                                                                    ].map(opt => (
                                                                        <button
                                                                            key={opt.cle}
                                                                            type="button"
                                                                            onClick={() => handleChangeStatus(absence, opt.cle)}
                                                                            className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${opt.couleur} ${
                                                                                absence.status === opt.cle ? "bg-slate-50" : ""
                                                                            }`}
                                                                        >
                                                                            {opt.libelle}
                                                                            {absence.status === opt.cle && (
                                                                                <Check className="w-3.5 h-3.5 inline-block ml-1.5 opacity-60" />
                                                                            )}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                        {mentionBilletLigne && <div>{mentionBilletLigne}</div>}
                                                    </div>
                                                );
                                            };

    const blocEleve = (absence: Absence) => {
        if (!absence.student) return <span className="text-slate-400 text-sm">Non assigné</span>;
        const nom = <span className="text-sm font-medium">{absence.student.firstName} {absence.student.lastName}</span>;
        return isAdmin ? (
            <Link href={`/students?highlight=${absence.studentId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors">
                <span className="p-1.5 bg-slate-100 rounded-full shrink-0"><User className="w-3.5 h-3.5" /></span>
                {nom}
            </Link>
        ) : (
            <span className="inline-flex items-center gap-2 text-slate-600">
                <span className="p-1.5 bg-slate-100 rounded-full shrink-0"><User className="w-3.5 h-3.5" /></span>
                {nom}
            </span>
        );
    };

    const dateCourte = (iso: string | null) =>
        iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "";

    // Envoi au parent, en badge court ; le détail est dans l'infobulle
    const badgeParent = (absence: Absence) => {
        if (absence.validated === true) {
            const detail = absence.parentNotice
                ? `Parent prévenu pour toute la journée${absence.validatedAt ? `, le ${new Date(absence.validatedAt).toLocaleDateString("fr-FR")}` : ""}`
                : `Envoyée au parent${absence.validatedAt ? ` le ${new Date(absence.validatedAt).toLocaleDateString("fr-FR")}` : ""}`;
            return (
                <span title={detail} className="inline-flex flex-col items-start px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Envoyée
                    </span>
                    <span className="text-[11px] font-medium opacity-75">
                        {dateCourte(absence.validatedAt)}{absence.parentNotice ? " · journée" : ""}
                    </span>
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                En attente
            </span>
        );
    };

    // Enseignant qui a fait le signalement et matière du cours
    const blocCours = (absence: Absence) => (
        <div className="min-w-0">
            {isAdmin && (
                <div className="text-sm font-medium text-slate-700 truncate" title={absence.teacher?.name || undefined}>
                    {absence.teacher?.name || <span className="text-slate-400">—</span>}
                </div>
            )}
            <div className={isAdmin ? "text-xs text-slate-500 truncate" : "text-sm text-slate-700 truncate"}>
                {absence.matiere || (isAdmin ? "" : "—")}
            </div>
        </div>
    );

    const boutonsActions = (absence: Absence) => (
        <div className="flex items-center justify-end gap-1.5">
            {isAdmin && absence.validated !== true && (
                <button
                    onClick={() => handleSend(absence)}
                    disabled={sendingId === absence.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                    title="Envoyer la notification au parent"
                >
                    {sendingId === absence.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Send className="w-3.5 h-3.5" />}
                    Envoyer
                </button>
            )}
            {isAdmin && !absence.billet && (absence.status === "retard" || (absence.status || "absence") === "absence") && (
                <button
                    onClick={() => handleBillet(absence)}
                    disabled={billetId === absence.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                    title={absence.status === "retard" ? "Émettre un billet de retard" : "Émettre un billet d'entrée"}
                >
                    {billetId === absence.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Ticket className="w-3.5 h-3.5" />}
                    Billet
                </button>
            )}
            {!isAdmin && (
                <button
                    onClick={() => handleDelete(absence)}
                    disabled={deletingId === absence.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                    title="Supprimer ce signalement"
                >
                    {deletingId === absence.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                </button>
            )}
        </div>
    );

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
                    <h1 className="text-3xl font-bold text-slate-900">Gestion des Absences</h1>
                    <p className="text-slate-500 mt-1">
                        {isAdmin
                            ? "Vérifiez les signalements saisis, puis envoyez-les aux parents."
                            : "Les signalements que vous avez saisis. Cliquez sur le type pour le corriger."}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                {tab === "students" && isAdmin && (
                    <Link href="/absences/appels" className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium border border-slate-200 flex items-center gap-2 transition-all active:scale-95">
                        <ClipboardCheck className="w-5 h-5 text-slate-500" />
                        Appels du jour
                    </Link>
                )}
                {tab === "students" && isAdmin && (
                    <Link href="/absences/feuille" className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium border border-slate-200 flex items-center gap-2 transition-all active:scale-95">
                        <FileText className="w-5 h-5 text-slate-500" />
                        Feuille de présence
                    </Link>
                )}
                {tab === "students" ? (
                    <Link href="/absences/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95">
                        <Plus className="w-5 h-5" />
                        Nouvelle absence
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={() => { resetForm(); setIsFormOpen(true); }}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-rose-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <UserX className="w-5 h-5" />
                        Déclarer une absence
                    </button>
                )}
                </div>
            </div>

            {/* Onglets — administration uniquement */}
            {isAdmin && (
                <div className="bg-slate-100 p-1 rounded-xl flex items-center w-fit">
                    <button
                        type="button"
                        onClick={() => setTab("students")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            tab === "students" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        Absences élèves
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("teachers")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            tab === "teachers" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        <UserX className="w-4 h-4" />
                        Absences enseignants
                    </button>
                </div>
            )}

            {tab === "students" && <>
            {/* Alertes de l'administration */}
            {isAdmin && alerts.length > 0 && (
                <div className="space-y-2">
                    {alerts.map((al) => (
                        <div key={al.id} className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200">
                            <BellRing className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-rose-900">{al.message}</p>
                                <p className="text-xs text-rose-600/70 mt-1">
                                    {new Date(al.createdAt).toLocaleString("fr-FR")}
                                </p>
                            </div>
                                                        <button
                                type="button"
                                onClick={() => handleAckAlert(al.id)}
                                className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-rose-700 text-sm font-bold hover:bg-rose-100 border border-rose-300 transition-colors flex items-center gap-1.5"
                            >
                                <Check className="w-4 h-4" />
                                OK
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Compteur des absences en attente */}
            {isAdmin && nouveauxCount > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800">
                            <span className="font-bold">{nouveauxCount} nouveau(x) signalement(s)</span> en attente d&apos;envoi aux parents.
                        </p>
                        {dateFilter && (
                            <button
                                type="button"
                                onClick={() => { setDateFilter(""); setStatusFilter("pending"); }}
                                className="text-xs font-bold text-amber-700 underline underline-offset-2 hover:text-amber-900 mt-1"
                            >
                                Les afficher tous
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setPendingVus(pendingCount);
                            try {
                                localStorage.setItem("absences-pending-vus", String(pendingCount));
                            } catch {
                                // stockage indisponible : le masquage ne durera que cette session
                            }
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-amber-700 text-sm font-bold hover:bg-amber-100 border border-amber-300 transition-colors flex items-center gap-1.5"
                        title="Masquer ce rappel"
                    >
                        <Check className="w-4 h-4" />
                        OK
                    </button>
                </div>
            )}

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Rechercher par élève..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto flex-wrap">
                    {/* Filtre par date */}
                    <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="pl-10 pr-3 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        />
                    </div>
                    {dateFilter ? (
                        <button
                            type="button"
                            onClick={() => setDateFilter("")}
                            className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 font-medium text-sm hover:bg-slate-100 border border-slate-200/50 transition-colors whitespace-nowrap"
                            title="Afficher toutes les dates"
                        >
                            Toutes les dates
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setDateFilter(todayLocal())}
                            className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 font-medium text-sm hover:bg-slate-100 border border-slate-200/50 transition-colors whitespace-nowrap"
                            title="Revenir à la journée en cours"
                        >
                            Aujourd&apos;hui
                        </button>
                    )}

                    {/* Filtre par statut */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="appearance-none pl-10 pr-8 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="pending">En attente</option>
                            <option value="sent">Envoyées</option>
                        </select>
                    </div>
                    {/* Filtre par classe */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <select
                            value={selectedClass}
                            name="class"
                            onChange={(e) => setSelectedClass(Number(e.target.value))}
                            className="appearance-none pl-10 pr-8 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 border border-slate-200/50 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                            <option value={0}>Filtrer par classe</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {classLabel(cls)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Période affichée */}
            <div className="flex items-center justify-between gap-4 -mt-4">
                <p className="text-sm text-slate-500">
                    {dateFilter
                        ? `Signalements du ${new Date(dateFilter).toLocaleDateString("fr-FR")}`
                        : "Tous les signalements de l'année scolaire"}
                    {` · ${filteredabsences.length} ligne(s)`}
                </p>
                <button
                    type="button"
                    onClick={rafraichir}
                    className="text-xs text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5 shrink-0"
                    title="Actualiser maintenant"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {derniereMaj
                        ? `Actualisé à ${derniereMaj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                        : "Actualiser"}
                </button>
            </div>

            {/* Table ; défilement horizontal quand l'écran est trop étroit */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className={`w-full text-left border-collapse ${isAdmin ? "min-w-[1020px]" : "min-w-[760px]"}`}>
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider whitespace-nowrap">Classe</th>
                                <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider whitespace-nowrap">Elève</th>
                                <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider whitespace-nowrap">Date</th>
                                <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider whitespace-nowrap">Créneau</th>
                                <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider">{isAdmin ? "Enseignant / Matière" : "Matière"}</th>
                                <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider whitespace-nowrap">Type</th>
                                {isAdmin && <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider whitespace-nowrap">Parent</th>}
                                <th className="p-3 text-xs font-semibold uppercase text-slate-500 tracking-wider whitespace-nowrap text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredabsences.map((absence, index) => (
                                <motion.tr
                                    key={absence.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="hover:bg-slate-50/80 transition-colors group"
                                >
                                    <td className="p-3 min-w-[84px]">
                                        <span className="text-sm font-medium">{classLabel(absence.classe)}</span>
                                    </td>
                                    <td className="p-3 min-w-[140px]">{blocEleve(absence)}</td>
                                    <td className="p-3">
                                        <span className="text-sm font-medium whitespace-nowrap">
                                            {absence.dateAbsence ? new Date(absence.dateAbsence).toLocaleDateString("fr-FR") : ""}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className="text-sm font-medium whitespace-nowrap">
                                            {absence.hourEnd ? `${absence.hour} - ${absence.hourEnd}` : absence.hour}
                                        </span>
                                    </td>
                                    <td className="p-3 max-w-[180px]">{blocCours(absence)}</td>
                                    <td className="p-3 min-w-[120px]">{celluleType(absence)}</td>
                                    {isAdmin && <td className="p-3">{badgeParent(absence)}</td>}
                                    <td className="p-3">{boutonsActions(absence)}</td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredabsences.length === 0 && (
                    <div className="p-12 text-center text-slate-400 bg-slate-50/50">
                        <User2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>
                            {dateFilter
                                ? `Aucun signalement le ${new Date(dateFilter).toLocaleDateString("fr-FR")}.`
                                : "Aucun signalement trouvé."}
                        </p>
                    </div>
                )}
            </div>
            </>}

            {/* ===== Onglet Absences enseignants ===== */}
            {tab === "teachers" && isAdmin && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Enseignant</th>
                                    <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Matière</th>
                                    <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Période</th>
                                    <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Classes prévenues</th>
                                    <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Motif</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {teacherAbsences.map((ta, index) => (
                                    <motion.tr
                                        key={ta.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-full">
                                                    <UserX className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-sm font-bold">{ta.teacher?.name || "—"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-slate-600">{ta.teacher?.subject?.name || "—"}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm font-medium text-slate-700">
                                                {new Date(ta.dateStart).toLocaleDateString("fr-FR")}
                                                {new Date(ta.dateStart).getTime() !== new Date(ta.dateEnd).getTime() &&
                                                    ` → ${new Date(ta.dateEnd).toLocaleDateString("fr-FR")}`}
                                                {ta.hourStart && ta.hourEnd && (
                                                    <span className="block text-xs text-slate-500 font-normal mt-0.5">
                                                        de {ta.hourStart} à {ta.hourEnd}
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {ta.classes.map(c => (
                                                    <span key={c.id} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                                        {classLabel(c)}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-slate-500">{ta.reason || "—"}</span>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {teacherAbsences.length === 0 && (
                        <div className="p-12 text-center text-slate-400 bg-slate-50/50">
                            <UserX className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Aucune absence d&apos;enseignant déclarée.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ===== Formulaire de déclaration ===== */}
            <AnimatePresence>
                {isFormOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                            onClick={() => setIsFormOpen(false)}
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
                            >
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Déclarer l&apos;absence d&apos;un enseignant</h2>
                                        <p className="text-sm text-slate-500">Les parents des classes choisies seront prévenus.</p>
                                    </div>
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-6">
                                    {/* Enseignant */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Enseignant<span className="text-red-500">*</span></label>
                                        <select
                                            value={formTeacherId}
                                            onChange={(e) => handleFormTeacherChange(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                                        >
                                            <option value="">Sélectionner un enseignant...</option>
                                            {teachers.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}{t.subject?.name ? ` — ${t.subject.name}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Journée entière ou quelques heures */}
                                    <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formAllDay}
                                            onChange={(e) => setFormAllDay(e.target.checked)}
                                            className="w-5 h-5 text-rose-600 border-slate-300 rounded-md focus:ring-rose-500 cursor-pointer"
                                        />
                                        <span className="text-sm font-bold text-slate-700 select-none">
                                            Absence sur la journée entière
                                        </span>
                                    </label>

                                    {formAllDay ? (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700">Du<span className="text-red-500">*</span></label>
                                                    <input
                                                        type="date"
                                                        value={formStart}
                                                        onChange={(e) => {
                                                            setFormStart(e.target.value);
                                                            if (!formEnd || formEnd < e.target.value) setFormEnd(e.target.value);
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700">Au<span className="text-red-500">*</span></label>
                                                    <input
                                                        type="date"
                                                        value={formEnd}
                                                        min={formStart || undefined}
                                                        onChange={(e) => setFormEnd(e.target.value)}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400 flex items-center gap-1.5 -mt-3">
                                                <CalendarDays className="w-3.5 h-3.5" />
                                                Pour une seule journée, indiquez la même date dans les deux champs.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">Date<span className="text-red-500">*</span></label>
                                                <input
                                                    type="date"
                                                    value={formStart}
                                                    onChange={(e) => { setFormStart(e.target.value); setFormEnd(e.target.value); }}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700">De<span className="text-red-500">*</span></label>
                                                    <select
                                                        value={formHourStart}
                                                        onChange={(e) => {
                                                            setFormHourStart(e.target.value);
                                                            if (formHourEnd && formHourEnd <= e.target.value) setFormHourEnd("");
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                                                    >
                                                        <option value="">Heure de début...</option>
                                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700">À<span className="text-red-500">*</span></label>
                                                    <select
                                                        value={formHourEnd}
                                                        onChange={(e) => setFormHourEnd(e.target.value)}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                                                    >
                                                        <option value="">Heure de fin...</option>
                                                        {HOURS.filter(h => !formHourStart || h > formHourStart).map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400 flex items-center gap-1.5 -mt-3">
                                                <CalendarDays className="w-3.5 h-3.5" />
                                                Une absence sur quelques heures ne concerne qu&apos;une seule journée.
                                            </p>
                                        </>
                                    )}

                                    {/* Motif */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Motif (facultatif)</label>
                                        <input
                                            type="text"
                                            value={formReason}
                                            onChange={(e) => setFormReason(e.target.value)}
                                            placeholder="Ex : maladie, formation..."
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                                        />
                                        <p className="text-xs text-slate-400">Le motif sera lu par les parents. Restez factuel.</p>
                                    </div>

                                    {/* Classes */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Classes concernées<span className="text-red-500">*</span></label>

                                        {!formTeacherId ? (
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
                                                <CalendarDays className="w-5 h-5 shrink-0" />
                                                Choisissez d&apos;abord l&apos;enseignant.
                                            </div>
                                        ) : formTeacherClasses.length === 0 ? (
                                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                <UserX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold text-amber-800 text-sm">Aucune classe rattachée à cet enseignant</p>
                                                    <p className="text-xs text-amber-700 mt-1">
                                                        Assignez-lui d&apos;abord ses classes depuis sa fiche, dans la rubrique Enseignants.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {formTeacherClasses.map((c: any) => {
                                                const checked = formClassIds.includes(c.id);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={c.id}
                                                        onClick={() => toggleFormClass(c.id)}
                                                        className={`text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                                            checked ? "border-rose-500 bg-rose-50" : "border-slate-200 bg-slate-50 hover:border-rose-300"
                                                        }`}
                                                    >
                                                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                                                            checked ? "bg-rose-600 border-rose-600" : "border-slate-300 bg-white"
                                                        }`}>
                                                            {checked && (
                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-800">{classLabel(c)}</span>
                                                        {c.students && (
                                                            <span className="ml-auto text-xs text-slate-400">{c.students.length} élève(s)</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        )}
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
                                    <span className="text-sm text-slate-500 font-medium">
                                        {formClassIds.length} classe(s) sélectionnée(s)
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
                                            Annuler
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveTeacherAbsence}
                                            disabled={isSaving}
                                            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Enregistrer et prévenir
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}