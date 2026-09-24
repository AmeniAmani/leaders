"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    GraduationCap,
    Users,
    BookOpen,
    Calendar,
    Settings,
    LogOut,
    UserCheck,
    School,
    X,
    MapPin,
    CreditCard,
    CalendarArrowDown,
    BookA,
    NotebookText,
    NotebookPen,
    LibraryBig,
    MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "./SidebarContext";
import { useEffect, useState } from 'react';
import { deconnecter, prolongerSessionProf, sessionProfExpiree } from "@/lib/session";

const routes = [
    {
        label: "Tableau de bord",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "text-sky-500",
        user: ["admin", "prof"]
    },
    {
        label: "Evénements",
        icon: CalendarArrowDown,
        href: "/events",
        color: "text-yellow-500",
        user: ["admin", "prof"]
    },
    {
        label: "Élèves",
        icon: GraduationCap,
        href: "/students",
        color: "text-violet-500",
        user: ["admin", "prof"]
    },
    {
        label: "Parents",
        icon: Users,
        href: "/parents",
        color: "text-pink-500",
        user: ["admin"]
    },
    {
        label: "Paiements",
        icon: CreditCard,
        href: "/payments",
        color: "text-blue-500",
        user: ["admin"],
        // Lien visible seulement pour ces comptes (la page reste accessible aux autres admins)
        logins: ["admin", "jouaira"]
    },
    {
        label: "Enseignants",
        icon: UserCheck,
        href: "/teachers",
        color: "text-orange-500",
        user: ["admin"]
    },
    {
        label: "Absences",
        icon: BookA,
        href: "/absences",
        color: "text-red-500",
        user: ["admin", "prof"]
    },
    {
        label: "Répartition Annuelle",
        icon: LibraryBig,
        href: "/planing",
        color: "text-green-500",
        user: ["admin", "prof"]
    },
    {
        label: "TAF/Devoir",
        icon: NotebookText,
        href: "/tafs",
        color: "text-purple-500",
        user: ["admin", "prof"]
    },
    {
        label: "Notes Devoirs",
        icon: NotebookPen,
        href: "/notesDevoirs",
        color: "text-yellow-500",
        user: ["admin", "prof"]
    },
    {
        label: "Notes Eduserv",
        icon: NotebookPen,
        href: "/notes",
        color: "text-red-500",
        user: ["admin"]
    },
    {
        label: "Classes",
        icon: School,
        href: "/classes",
        color: "text-emerald-500",
        user: ["admin", "prof"]
    },
    {
        label: "Matières",
        icon: BookOpen,
        href: "/subjects",
        color: "text-blue-500",
        user: ["admin"]
    },
    {
        label: "Salles",
        icon: MapPin,
        href: "/rooms",
        color: "text-amber-500",
        user: ["admin", "prof"]
    },
    {
        label: "Emploi du temps",
        icon: Calendar,
        href: "/schedule",
        color: "text-indigo-500",
        user: ["admin", "prof"]
    },
    {
        label: "Chat",
        icon: MessageSquare,
        href: "/chat",
        color: "text-indigo-500",
        user: ["admin"]
    },
];

export const Sidebar = () => {
    const pathname = usePathname();
    const { isOpen, close } = useSidebar();

    const getCookie = (name: string) => {
        if (typeof document === "undefined") return null;

        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] ?? null;
    };

    const [role, setRole] = useState('');
    // Identifiant du compte connecté (pour un admin, user-name contient son login)
    const [login, setLogin] = useState('');

    useEffect(() => {
        setRole(getCookie("user-role") ?? "N/A");
        setLogin(decodeURIComponent(getCookie("user-name") ?? ""));
    }, []);

    // Session enseignant (tablette partagée) : déconnexion après 1 heure sans activité.
    // Chaque toucher, clic, frappe ou défilement prolonge la session (au plus une fois
    // par minute). Contrôle toutes les 30 s, au réveil de la tablette, au retour sur
    // l'onglet et au bouton Retour du navigateur.
    useEffect(() => {
        if (role !== "prof") return;

        const verifier = () => {
            if (sessionProfExpiree()) deconnecter("/prof");
        };

        let derniereProlongation = 0;
        const activite = () => {
            if (Date.now() - derniereProlongation < 60000) return;
            if (sessionProfExpiree()) return verifier();
            derniereProlongation = Date.now();
            prolongerSessionProf();
        };

        const auRetour = () => {
            if (document.visibilityState === "visible") verifier();
        };

        const EVENEMENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
        verifier();
        const timer = setInterval(verifier, 30000);
        EVENEMENTS.forEach(e => window.addEventListener(e, activite, { passive: true, capture: true }));
        document.addEventListener("visibilitychange", auRetour);
        window.addEventListener("pageshow", verifier);
        window.addEventListener("focus", verifier);
        return () => {
            clearInterval(timer);
            EVENEMENTS.forEach(e => window.removeEventListener(e, activite, { capture: true }));
            document.removeEventListener("visibilitychange", auRetour);
            window.removeEventListener("pageshow", verifier);
            window.removeEventListener("focus", verifier);
        };
    }, [role]);

    // Administration : demandes de réservation de salle en attente, en pastille sur « Salles ».
    // Relu toutes les 30 s, au retour sur l'onglet, à chaque page et après une décision.
    const [reservationsEnAttente, setReservationsEnAttente] = useState(0);
    useEffect(() => {
        if (role !== "admin") return;
        let actif = true;
        const compter = async () => {
            try {
                const res = await fetch("/api/reservations?compte=1", { cache: "no-store" });
                const data = res.ok ? await res.json() : null;
                if (actif && data) setReservationsEnAttente(data.enAttente || 0);
            } catch {
                // Pastille laissée telle quelle en cas d'erreur réseau
            }
        };
        compter();
        const timer = setInterval(compter, 30000);
        window.addEventListener("focus", compter);
        window.addEventListener("admin-alerts:refresh", compter);
        return () => {
            actif = false;
            clearInterval(timer);
            window.removeEventListener("focus", compter);
            window.removeEventListener("admin-alerts:refresh", compter);
        };
    }, [role, pathname]);

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();

        // Tous les cookies de session sont effacés, retour à la page de connexion de l'espace
        deconnecter(role === "prof" ? "/prof" : "/login");
    };

    return (
        <>
            {/* Desktop & Mobile Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-white transition-transform duration-300 ease-in-out md:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-full flex flex-col glass-effect-sidebar bg-[#111827]">
                    {/* Logo with close button for mobile */}
                    <div className="px-6 py-4 flex items-center justify-between">
                        <Link href="/dashboard" className="flex items-center gap-x-2">
                            <div className="w-10 h-10 rounded-xl"><img src="/logo.png" alt="Logo" className="w-10 h-10" /></div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-white">
                                GSI Leaders
                            </h1>
                        </Link>
                        <button
                            onClick={close}
                            className="md:hidden text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Routes */}
                    <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        {routes.map((route) => ((route?.user?.includes(role)) && (!route.logins || route.logins.includes(login)) &&
                            <Link
                                key={route.href}
                                href={route.href}
                                onClick={() => close()}
                                className={cn(
                                    "flex items-center group w-full p-3 rounded-xl transition-all duration-200 hover:bg-white/10",
                                    pathname === route.href
                                        ? "bg-white/10 text-white shadow-lg shadow-indigo-500/10"
                                        : "text-zinc-400"
                                )}
                            >
                                <div className={cn("flex items-center flex-1")}>
                                    <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                    <span className="font-medium text-sm">{route.label}</span>
                                    {route.href === "/rooms" && role === "admin" && reservationsEnAttente > 0 && (
                                        <span
                                            className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center"
                                            title="Demandes de réservation en attente"
                                        >
                                            {reservationsEnAttente > 9 ? "9+" : reservationsEnAttente}
                                        </span>
                                    )}
                                </div>
                                {pathname === route.href && (
                                    <motion.div
                                        layoutId="active-nav"
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-500 ml-auto"
                                    />
                                )}
                            </Link>
                        ))}
                    </div>

                    {/* User / Settings Footer */}
                    <div className="mt-auto px-3 py-4 border-t border-white/10">
                        {/* Paramètres : lien réservé au compte « admin » (la page reste accessible aux autres admins) */}
                        {role === "admin" && login === "admin" && <Link href="/settings" onClick={() => close()} className="flex items-center p-3 rounded-xl hover:bg-white/10 text-zinc-400 transition-colors">
                            <Settings className="h-5 w-5 mr-3" />
                            <span className="font-medium text-sm">Paramètres</span>
                        </Link>}
                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full p-3 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors mt-1"
                        >
                            <LogOut className="h-5 w-5 mr-3" />
                            <span className="font-medium text-sm">Déconnexion</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
                        onClick={close}
                    />
                )}
            </AnimatePresence>
        </>
    );
};