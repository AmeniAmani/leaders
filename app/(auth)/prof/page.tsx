"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, ChevronRight, Loader2, AlertCircle, Download, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { effacerSession, ouvrirSessionProf } from "@/lib/session";

export default function LoginProfPage() {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [wrongRole, setWrongRole] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // Installation de l'application sur l'ecran d'accueil (tablette, telephone)
    const [promptInstall, setPromptInstall] = useState<any>(null);
    const [dejaInstallee, setDejaInstallee] = useState(false);
    const [aideInstall, setAideInstall] = useState(false);

    useEffect(() => {
        // Chrome previent quand la page peut etre installee
        const onPrompt = (e: any) => {
            e.preventDefault();
            setPromptInstall(e);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);

        // Deja ouverte depuis l'ecran d'accueil : inutile de proposer
        if (window.matchMedia("(display-mode: standalone)").matches) {
            setDejaInstallee(true);
        }

        return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    }, []);

    const installer = async () => {
        if (!promptInstall) {
            setAideInstall(true);
            return;
        }
        promptInstall.prompt();
        const choix = await promptInstall.userChoice;
        if (choix?.outcome === "accepted") setDejaInstallee(true);
        setPromptInstall(null);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setWrongRole(false);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Erreur lors de la connexion via API");
            }

            const userData = await res.json();

            // Cette page est reservee aux enseignants
            if (userData.role !== "prof") {
                setError("Ce compte est un compte administrateur.");
                setWrongRole(true);
                setIsLoading(false);
                return;
            }

            // Session enseignant : fin après 1 heure sans activité (lib/session.ts)
            effacerSession();
            ouvrirSessionProf(userData);

            // Tablette partagée : les champs sont vidés avant de quitter la page
            setLogin("");
            setPassword("");

            router.push("/dashboard");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Une erreur est survenue lors de la connexion.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-slate-50">
            <div className="w-full lg:w-[45%] p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white shadow-2xl z-10">
                <div className="max-w-md w-full mx-auto space-y-8">

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-10 h-10 rounded-xl">
                                <img src="/logo.png" alt="Logo" className="w-10 h-10" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900">GSI College Les Leaders Boumhel</h1>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold">
                            <UserCheck className="w-4 h-4" />
                            Espace Enseignant
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 pt-2">
                            Bienvenue
                        </h2>
                        <p className="text-slate-500">
                            Connectez-vous pour saisir vos absences, devoirs et notes.
                        </p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-start gap-3 text-sm"
                            >
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p>{error}</p>
                                    {wrongRole && (
                                        <Link href="/login" className="font-semibold text-indigo-700 hover:text-indigo-600 underline underline-offset-4 mt-1 inline-block">
                                            Aller a l espace administration
                                        </Link>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.form
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        onSubmit={handleLogin}
                        autoComplete="off"
                        className="space-y-5"
                    >
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900">Identifiant</label>
                            <input
                                type="text"
                                required
                                autoComplete="off"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="votre login"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-900">Mot de passe</label>
                                <button
                                    type="button"
                                    onClick={() => setError("Veuillez contacter l administration pour reinitialiser votre mot de passe")}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                                >
                                    Oublie ?
                                </button>
                            </div>
                            <input
                                type="password"
                                required
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="........"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Se connecter
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </motion.form>

                    <div className="text-center pt-2">
                        <Link href="/login" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                            Vous etes administrateur ? <span className="font-semibold underline underline-offset-4">Connectez-vous ici</span>
                        </Link>
                    </div>

                </div>

                <div className="mt-auto text-center space-y-3">
                    {!dejaInstallee && (
                        <div>
                            <button
                                type="button"
                                onClick={installer}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 border border-indigo-200 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Installer l&apos;application sur cet appareil
                            </button>

                            {aideInstall && (
                                <div className="mt-3 mx-auto max-w-sm flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-left">
                                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-slate-500 space-y-2">
                                        <p>
                                            <span className="font-semibold text-slate-700">Sur Android (Chrome)</span> : ouvrez
                                            le menu du navigateur, les trois points en haut à droite, puis choisissez
                                            <span className="font-semibold text-slate-700"> Installer et créer un raccourci </span>
                                            ou <span className="font-semibold text-slate-700">Ajouter à l&apos;écran d&apos;accueil</span>,
                                            selon la version de Chrome.
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-700">Sur iPad ou iPhone (Safari)</span> : touchez
                                            le bouton <span className="font-semibold text-slate-700">Partager</span>, puis
                                            <span className="font-semibold text-slate-700"> Sur l&apos;écran d&apos;accueil</span>.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-slate-400 text-sm">2025 College Les Leaders Boumhel. Tous droits reserves.</p>
                    <p className="text-slate-400 text-sm">
                        <a href="/api/auth/apk" download className="text-indigo-600 hover:text-indigo-500 font-medium underline-offset-4 hover:underline">
                            Telecharger l application Parent Mobile
                        </a>
                    </p>
                </div>
            </div>

            <div className="hidden lg:flex flex-1 justify-center items-center relative overflow-hidden bg-slate-900">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-violet-600/90 z-10 mix-blend-multiply" />
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/30 blur-3xl" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-500/30 blur-3xl" />

                <div className="relative z-20 flex flex-col items-center justify-center p-16 text-center h-full">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                    >
                        <h2 className="text-4xl font-bold text-white mb-6">Votre espace de travail</h2>
                        <p className="text-indigo-100 text-lg max-w-lg leading-relaxed">
                            Faites l appel, publiez vos devoirs, saisissez vos notes et consultez
                            votre emploi du temps. Ce que vous enregistrez parvient aux familles.
                        </p>
                    </motion.div>

                    <div className="mt-12 relative w-full max-w-md aspect-video bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm shadow-2xl p-6 flex flex-col gap-4">
                        <img src="/img.jpg" alt="College Les Leaders Boumhel" />
                    </div>
                </div>
            </div>
        </div>
    );
}