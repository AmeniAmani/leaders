// Service worker volontairement SANS cache.
//
// Son unique raison d'être : Chrome exige un gestionnaire « fetch » pour
// considérer le site comme installable (PWA). Il ne stocke rien, donc il ne
// peut jamais servir une version obsolète de l'application : chaque requête
// part sur le réseau.

self.addEventListener('install', () => {
    // Le nouveau worker remplace l'ancien sans attendre la fermeture des onglets.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Sécurité : efface tout cache qu'une version précédente aurait laissé.
        const noms = await caches.keys();
        await Promise.all(noms.map((nom) => caches.delete(nom)));
        await self.clients.claim();
    })());
});

// Page de secours affichée uniquement si le réseau est injoignable.
// Ce n'est pas une copie de l'application : aucune page métier n'est stockée.
const PAGE_HORS_LIGNE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hors connexion</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background:#f8fafc; color:#334155; }
  .boite { text-align:center; padding:2rem; max-width:22rem; }
  h1 { font-size:1.125rem; color:#0f172a; margin:0 0 .5rem; }
  p { font-size:.875rem; line-height:1.5; margin:0; }
</style>
</head>
<body>
  <div class="boite">
    <h1>Pas de connexion</h1>
    <p>L'application a besoin du réseau pour afficher des données à jour.
       Vérifiez le Wi-Fi, puis réessayez.</p>
  </div>
</body>
</html>`;

self.addEventListener('fetch', (event) => {
    const requete = event.request;

    // On ne touche qu'aux lectures : les envois de formulaire passent sans interférence.
    if (requete.method !== 'GET') return;

    event.respondWith(
        fetch(requete).catch(() => {
            if (requete.mode === 'navigate') {
                return new Response(PAGE_HORS_LIGNE, {
                    status: 503,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                });
            }
            return Response.error();
        })
    );
});
