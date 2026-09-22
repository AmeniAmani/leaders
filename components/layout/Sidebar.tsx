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
import { useRouter } from "next/navigation";
import { useSidebar } from "./SidebarContext";
import { useEffect, useState } from 'react';

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
        user: ["admin"]
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
    const router = useRouter();
    const { isOpen, close } = useSidebar();

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

    // Session enseignant : quand le cookie auth-token expire (1 heure),
    // retour automatique vers la page de connexion enseignant.
    useEffect(() => {
        if (role !== "prof") return;

        const verifier = () => {
            if (!getCookie("auth-token")) {
                window.location.href = "/prof";
            }
        };

        verifier();
        const timer = setInterval(verifier, 30000);
        return () => clearInterval(timer);
    }, [role]);

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();

        // On retient l'espace avant d'effacer les cookies
        const destination = role === "prof" ? "/prof" : "/login";

        // Clear all session cookies
        document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "user-name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "user-id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

        router.push(destination);
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
                        {routes.map((route) => ((route?.user?.includes(role)) &&
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
                        {role === "admin" && <Link href="/settings" onClick={() => close()} className="flex items-center p-3 rounded-xl hover:bg-white/10 text-zinc-400 transition-colors">
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