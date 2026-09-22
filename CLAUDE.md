# CLAUDE.md

## PWA en attente

Objectif : un clic sur « Installer l'application sur cet appareil » (page `/prof`) installe
l'application sur l'écran d'accueil avec le logo de l'école, et l'ouvre en plein écran sans
barre Chrome. Chantier suspendu le 2026-09-22, en attente d'un nom de domaine.

### Pourquoi le bouton ne marche pas aujourd'hui

`beforeinstallprompt` n'est émis qu'en contexte sécurisé. Le site étant servi en HTTP
(`http://137.74.42.196:3000`), l'événement ne part jamais : `promptInstall` reste `null` et
`installer()` dans `app/(auth)/prof/page.tsx` tombe dans la branche qui affiche l'aide.
« Ajouter à l'écran d'accueil » crée alors un simple marque-page, qui s'ouvre dans un onglet
Chrome — le `display: standalone` du manifest n'est honoré que par une vraie WebAPK.

### Fait, mais pas déployé

- `public/sw.js` — service worker **sans aucun cache** : chaque GET part sur le réseau, les
  POST/PUT ne sont pas interceptés, et tout cache résiduel est effacé à l'activation. Une
  seule exception : une page « Pas de connexion » en HTML inline, renvoyée uniquement si le
  réseau est injoignable lors d'une navigation. Aucune version obsolète ne peut être servie.
- `components/pwa/ServiceWorkerRegister.tsx` — enregistrement, monté dans `app/layout.tsx`.
  Sort immédiatement si `window.isSecureContext` est faux : inactif tant qu'on est en HTTP,
  il s'activera seul une fois le HTTPS en place, sans modification de code.
- `public/icon-maskable-512.png` — logo recentré à 70 % (358 px dans 512 px, fond blanc),
  généré avec `sharp` depuis `public/logo.png`. Déclaré `purpose: "maskable"` dans
  `public/manifest.json` ; `icon-512.png` reste en `purpose: "any"`.
- `app/(auth)/prof/page.tsx` — aide réécrite avec les deux libellés Chrome (« Installer et
  créer un raccourci », « Ajouter à l'écran d'accueil ») et le cas iPad (Partager → Sur
  l'écran d'accueil).

Vérifié : `tsc --noEmit` OK, ESLint OK sur les fichiers touchés, `node --check public/sw.js` OK.
**Aucun build ni redémarrage n'a été fait : le site sert encore le build précédent.**

### Reste à faire

1. **Domaine** — bloquant. Let's Encrypt n'émet pas pour une IP nue : il faut un
   enregistrement A vers `137.74.42.196`.
2. **HTTPS** — `certbot --nginx`, bloc `listen 443 ssl` dans
   `/etc/nginx/sites-available/leaders` (aujourd'hui `listen 80` seul, proxy vers
   `127.0.0.1:3000`), puis redirection 80 → 443. Le port 443 est libre et déjà ouvert dans
   ufw ; efatoora occupe le 8443.
3. **URL des tablettes** — elles utilisent `http://137.74.42.196:3000`, qui court-circuite
   nginx et restera en HTTP même après le certificat. Passer à `https://<domaine>` sans port,
   puis envisager de fermer le 3000 dans ufw.
4. **Accents de `app/(auth)/prof/page.tsx`** — le reste du fichier est sans accents
   (« Telecharger l application Parent Mobile », « Tous droits reserves »). Volontairement
   non corrigé, hors du périmètre demandé.
5. **Build et redémarrage** — `npm run build` puis `systemctl restart monsite`, uniquement
   sur accord explicite de l'utilisateur.
