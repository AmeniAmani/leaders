"use client";

import { TexteMixte } from "@/components/ui/TexteMixte";
import { Bell, Search, Menu as MenuIcon, Loader2, User, GraduationCap, Users as UsersIcon, BookA, AlertTriangle, Clapperboard, CalendarDays } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSidebar } from "./SidebarContext";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { estAlerteAbsence, estAlerteRepartition, estAlerteReservation } from "@/lib/alertes";

interface AdminAlertItem {
    id: number;
    type: string | null;
    message: string;
    createdAt: string;
    read: boolean;
    // Enseignant : billet d'entrée à valider
    billet?: { id: number; type: string; statut: string } | null;
}

// Temps écoulé, en clair
const depuis = (iso: string) => {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const heures = Math.floor(minutes / 60);
    if (heures < 24) return `il y a ${heures} h`;
    return new Date(iso).toLocaleDateString("fr-FR");
};

export const Topbar = () => {
    const [user, setUser] = useState({ name: "Utilisateur", role: "" });
    const [isAdmin, setIsAdmin] = useState(false);
    const [isProf, setIsProf] = useState(false);
    const { toggle } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Alerts state
    const [alerts, setAlerts] = useState<AdminAlertItem[]>([]);
    const [showAlerts, setShowAlerts] = useState(false);
    const alertsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {} as Record<string, string>);

        const name = cookies['user-name'] ? decodeURIComponent(cookies['user-name']) : "Utilisateur";
        const role = cookies['user-role'] || "";

        const roleDisplay = role === "admin" ? "Administrateur" : role === "prof" ? "Enseignant" : role;

        setUser({ name, role: roleDisplay });
        setIsAdmin(role === "admin");
        setIsProf(role === "prof");
    }, []);

    // Administration : alertes. Enseignant : billets envoyés par l'administration.
    const alertesActives = isAdmin || isProf;
    const alertsUrl = isAdmin ? "/api/admin-alerts" : "/api/teacher-notifications";

    // Chargement des alertes non lues
    const fetchAlerts = useCallback(async () => {
        try {
            const res = await fetch(alertsUrl, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            const list: AdminAlertItem[] = Array.isArray(data) ? data : (data.alerts ?? []);
            setAlerts(
                list
                    .filter((a) => !a.read)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
        } catch (error) {
            console.error("Failed to fetch alerts:", error);
        }
    }, [alertsUrl]);

    // Actualisation : toutes les 30 s, au retour sur l'onglet, et sur demande
    useEffect(() => {
        if (!alertesActives) return;
        fetchAlerts();
        const timer = setInterval(fetchAlerts, 30000);
        window.addEventListener("focus", fetchAlerts);
        window.addEventListener("admin-alerts:refresh", fetchAlerts);
        return () => {
            clearInterval(timer);
            window.removeEventListener("focus", fetchAlerts);
            window.removeEventListener("admin-alerts:refresh", fetchAlerts);
        };
    }, [alertesActives, fetchAlerts]);

    // Actualisation à chaque changement de page
    useEffect(() => {
        if (alertesActives) fetchAlerts();
    }, [pathname, alertesActives, fetchAlerts]);

    const dismissAlert = async (id: number) => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        try {
            await fetch(alertsUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertId: id }),
            });
        } catch (error) {
            console.error("Failed to dismiss alert:", error);
        }
    };

    // Enseignant : l'élève s'est présenté avec son billet d'entrée, ou pas
    const [billetEnCours, setBilletEnCours] = useState<number | null>(null);
    const traiterBillet = async (alert: AdminAlertItem, arrive: boolean) => {
        if (!alert.billet) return;
        if (!arrive && !window.confirm(
            "Signaler que l'élève n'est pas arrivé ?\n\nL'administration en sera informée et l'élève redeviendra absent sur ce cours."
        )) return;
        setBilletEnCours(alert.id);
        try {
            const res = await fetch("/api/billets/valider", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ billetId: alert.billet.id, arrive }),
            });
            const data = await res.json();
            if (!res.ok) window.alert(data.error || "Erreur lors de la validation du billet");
            // La feuille d'appel ouverte se met à jour
            window.dispatchEvent(new Event("billets:refresh"));
        } catch (error) {
            console.error("Failed to validate billet:", error);
        } finally {
            setBilletEnCours(null);
            fetchAlerts();
        }
    };

    // Search logic with debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true);
                try {
                    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setResults(data);
                        setShowResults(true);
                    }
                } catch (error) {
                    console.error("Search failed:", error);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Click away listener (recherche + alertes)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
            if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
                setShowAlerts(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case 'student': return <GraduationCap className="h-4 w-4 text-violet-500" />;
            case 'teacher': return <User className="h-4 w-4 text-orange-500" />;
            case 'parent': return <UsersIcon className="h-4 w-4 text-pink-500" />;
            default: return <Search className="h-4 w-4 text-slate-400" />;
        }
    };

    return (
        <div className="h-20 px-4 md:px-8 flex items-center justify-between glass-effect border-b bg-white/50 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-x-4">
                <button
                    onClick={toggle}
                    className="p-2 md:hidden hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <MenuIcon className="h-6 w-6 text-slate-600" />
                </button>
                <h2 className="text-xl font-semibold text-slate-800 hidden md:block">
                    Tableau de bord
                </h2>
            </div>

            <div className="flex items-center gap-x-6">
                {/* Search */}
                <div ref={searchRef} className="relative hidden md:block">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                            className="pl-10 pr-10 py-2 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64 transition-all"
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                        )}
                    </div>

                    {/* Results Dropdown */}
                    <AnimatePresence>
                        {showResults && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-full mt-2 w-[400px] left-0 md:left-auto md:right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                            >
                                <div className="p-2 max-h-[400px] overflow-y-auto">
                                    {results.length > 0 ? (
                                        <div className="space-y-1">
                                            {results.map((result) => (
                                                <button
                                                    key={result.id}
                                                    onClick={() => {
                                                        router.push(result.href);
                                                        setShowResults(false);
                                                        setSearchQuery("");
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                                                >
                                                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                                                        {result.photo ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={result.photo} alt="" className="h-full w-full object-cover" />
                                                        ) : (
                                                            getIcon(result.type)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{result.title}</p>
                                                        <p className="text-xs text-slate-500">{result.subtitle}</p>
                                                    </div>
                                                    <div className="ml-auto flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                            {result.type}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center">
                                            <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                            <p className="text-sm text-slate-500">Aucun résultat pour {searchQuery}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Alertes (administration) ou billets reçus (enseignant) */}
                {alertesActives && (
                    <div ref={alertsRef} className="relative">
                        <button
                            type="button"
                            title="Alertes"
                            onClick={() => {
                                if (!showAlerts) fetchAlerts();
                                setShowAlerts(!showAlerts);
                            }}
                            className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <Bell className="h-5 w-5 text-slate-600" />
                            {alerts.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                                    {alerts.length > 9 ? "9+" : alerts.length}
                                </span>
                            )}
                        </button>

                        <AnimatePresence>
                            {showAlerts && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                                >
                                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                        <p className="font-bold text-slate-900 text-sm">{isAdmin ? "Alertes" : "Notifications"}</p>
                                        <span className="text-xs text-slate-500">
                                            {alerts.length} en attente
                                        </span>
                                    </div>

                                    <div className="max-h-[420px] overflow-y-auto">
                                        {alerts.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <Bell className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                                <p className="text-sm text-slate-500">Aucune alerte en attente</p>
                                            </div>
                                        ) : (
                                            <ul className="divide-y divide-slate-50">
                                                {alerts.map((alert) => {
                                                    const estAbsence = estAlerteAbsence(alert.type);
                                                    // Réservation de la salle de cinéma : la page des réservations
                                                    const estReservation = estAlerteReservation(alert.type);
                                                    // Répartition d'un enseignant : la page des répartitions
                                                    const estRepartition = estAlerteRepartition(alert.type);
                                                    return (
                                                        <li key={alert.id} className="p-3 flex gap-3 hover:bg-slate-50 transition-colors">
                                                            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${estRepartition ? "bg-sky-50" : estReservation ? "bg-indigo-50" : estAbsence ? "bg-red-50" : "bg-amber-50"}`}>
                                                                {estRepartition
                                                                    ? <CalendarDays className="h-4 w-4 text-sky-500" />
                                                                    : estReservation
                                                                    ? <Clapperboard className="h-4 w-4 text-indigo-500" />
                                                                    : estAbsence
                                                                    ? <BookA className="h-4 w-4 text-red-500" />
                                                                    : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setShowAlerts(false);
                                                                        // L'enseignant retrouve l'élève dans sa feuille d'appel
                                        router.push(
                                            estRepartition ? "/planing" :
                                            estReservation ? (isAdmin ? "/rooms/reservations" : "/rooms/cinema") :
                                            isAdmin ? "/absences" : "/absences/new"
                                        );
                                                                    }}
                                                                    className="text-left text-sm text-slate-700 leading-snug hover:text-indigo-600 transition-colors"
                                                                >
                                                                    <TexteMixte texte={alert.message} />
                                                                </button>
                                                                <div className="flex items-center justify-between mt-1">
                                                                    <span className="text-[11px] text-slate-400">
                                                                        {depuis(alert.createdAt)}
                                                                    </span>
                                                                    {alert.billet?.type === "entree" && alert.billet.statut === "en_attente" ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => traiterBillet(alert, false)}
                                                                                disabled={billetEnCours === alert.id}
                                                                                className="text-[11px] font-bold text-red-600 hover:text-red-500 disabled:opacity-50"
                                                                            >
                                                                                Non arrivé
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => traiterBillet(alert, true)}
                                                                                disabled={billetEnCours === alert.id}
                                                                                className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 disabled:opacity-50"
                                                                            >
                                                                                Valider l&apos;arrivée
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => dismissAlert(alert.id)}
                                                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500"
                                                                        >
                                                                            OK
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* User Profile */}
                <div className="flex items-center gap-x-3 cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.role}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-indigo-100 border-2 border-indigo-500 flex items-center justify-center">
                        <span className="text-indigo-600 font-bold">{user.role.charAt(0)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};