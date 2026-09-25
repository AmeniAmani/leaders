"use client";

import { TexteMixte } from "@/components/ui/TexteMixte";
import { Users, UserCheck, GraduationCap, School, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Event {
    id: number;
    name: string;
    target: number;
    dateEvent: string;
    description: string;
}
interface Activity {
    id: number;
    nameUser: string;
    dateActivity: string;
    description: string;
}

export default function DashboardPage() {
    const [userName, setUserName] = useState("Admin");
    const [isLoading, setIsLoading] = useState(true);
    const [events, setEvents] = useState<Event[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [studCnt, setStudCnt] = useState(0);
    const [teachCnt, setTeach] = useState(0);
    const [parentCnt, setParent] = useState(0);
    const [classCnt, setClass] = useState(0);

    const fetchEvents = async () => {
        try {
            const studentsRes = await fetch(`/api/students/count`);
            const teachersRes = await fetch(`/api/teachers/count`);
            const parentsRes = await fetch(`/api/parents/count`);
            const classesRes = await fetch(`/api/classes/count`);
            const eventRes = await fetch(`/api/events/first`);
            const activityRes = await fetch(`/api/activities`);
            if (studentsRes.ok && teachersRes.ok && parentsRes.ok && classesRes.ok) {
                setStudCnt(await studentsRes.json());
                setTeach(await teachersRes.json());
                setParent(await parentsRes.json());
                setClass(await classesRes.json());
            }
            if (eventRes.ok) {
                setEvents(await eventRes.json());
            }
            if (activityRes.ok) {
                setActivities(await activityRes.json());
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {} as Record<string, string>);

        if (cookies['user-name']) {
            setUserName(decodeURIComponent(cookies['user-name']));
        }

        fetchEvents();

    }, []);

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

    const stats = [
        {
            label: "Total Élèves",
            value: studCnt.toString(),
            icon: GraduationCap,
            change: "+12%",
            color: "text-violet-600",
            bg: "bg-violet-100",
        },
        {
            label: "Enseignants",
            value: teachCnt.toString(),
            icon: UserCheck,
            change: "+4%",
            color: "text-emerald-600",
            bg: "bg-emerald-100",
        },
        {
            label: "Parents",
            value: parentCnt.toString(),
            icon: Users,
            change: "+8%",
            color: "text-pink-600",
            bg: "bg-pink-100",
        },
        {
            label: "Classes",
            value: classCnt.toString(),
            icon: School,
            change: "0%",
            color: "text-indigo-600",
            bg: "bg-indigo-100",
        },
    ];

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                    Bonjour, {userName}
                </h1>
                <p className="text-slate-500 mt-2">
                    Voici un aperçu de l'activité de votre établissement aujourd'hui.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-800 mt-2 group-hover:scale-105 transition-transform origin-left">
                                    {stat.value}
                                </p>
                            </div>
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                        </div>
                        {/* 
                        <div className="mt-4 flex items-center text-sm">
                            <span className="text-emerald-500 font-medium">{stat.change}</span>
                            <span className="text-slate-400 ml-2">depuis le mois dernier</span>
                        </div>*/}
                    </div>
                ))}
            </div>

            {/* Recent Activity / Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {!isReadOnly && <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">
                        <Link href="/activities" className="hover:text-indigo-500 transition-colors">Activités Récentes</Link>
                    </h3>
                    <div className="space-y-4">
                        {activities.map((i) => (
                            <div key={i.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                                    {i.nameUser.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{i.nameUser} <TexteMixte texte={i.description} /></p>
                                    <p className="text-xs text-slate-400">Le {new Date(i.dateActivity).toLocaleDateString("fr-FR")} à {new Date(i.dateActivity).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                                </div>
                            </div>
                        ))}
                        {activities.length === 0 && (
                            <p className="text-sm text-slate-500">Aucune activité récente disponible.</p>
                        )}
                    </div>
                </div>}

                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-xl font-bold mb-2">{
                            events?.[0]?.name || "Pas d'événement programmé prochainement"}</h3>
                        <p className="text-indigo-100 mb-6 max-w-sm">
                            {events?.[0] && `${events?.[0]?.description} prévu le : ${new Date(events?.[0]?.dateEvent).toLocaleDateString("fr-FR")}` || "Veuillez consulter le planning des événements pour plus de détails."}
                        </p>
                        <button className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-50 transition-colors">
                            <Link href="/events">Voir le planning</Link>
                        </button>
                    </div>

                    {/* Decorative circles */}
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute right-20 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                </div>
            </div>
        </div>
    );
}
