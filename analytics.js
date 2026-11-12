// Mesure d'audience Microsoft Clarity, chargée uniquement après consentement (règles CNIL)
// - Bandeau « Accepter / Refuser » avec le même poids visuel pour les deux choix
// - Choix mémorisé 6 mois, modifiable à tout moment via le lien « Cookies » du pied de page
// - Liens suivis : elodie-dene.fr/?ref=entreprise → étiquette Clarity « ref = entreprise »
// - Clic sur le CV → événement Clarity « cv_download »
(() => {
    const CLARITY_ID = 'zcgkw8jbiz'; // ← identifiant du projet Clarity, à renseigner
    const STORAGE_KEY = 'consent-clarity'; // nouvelle clé : le consentement donné à Hotjar ne vaut pas pour Clarity
    const MAX_AGE = 1000 * 60 * 60 * 24 * 182; // 6 mois

    if (!CLARITY_ID) return; // tant qu'il n'y a pas d'identifiant, rien ne s'affiche

    const store = {
        get(storage, key) { try { return storage.getItem(key); } catch { return null; } },
        set(storage, key, value) { try { storage.setItem(key, value); } catch { /* stockage bloqué */ } },
    };

    // Mémorise le ?ref= de la page d'arrivée pour la durée de la visite
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref) store.set(sessionStorage, 'visit-ref', ref.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40));

    function readConsent() {
        try {
            const saved = JSON.parse(store.get(localStorage, STORAGE_KEY));
            if (saved && Date.now() - saved.date < MAX_AGE) return saved.value;
        } catch { /* valeur absente ou illisible */ }
        return null;
    }

    function saveConsent(value) {
        store.set(localStorage, STORAGE_KEY, JSON.stringify({ value, date: Date.now() }));
    }

    function loadTracker() {
        if (window.clarity) return;
        window.clarity = function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
        const s = document.createElement('script');
        s.async = true;
        s.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
        document.head.appendChild(s);

        window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });

        const visitRef = store.get(sessionStorage, 'visit-ref');
        if (visitRef) window.clarity('set', 'ref', visitRef);

        document.addEventListener('click', (e) => {
            if (e.target.closest('a[href$="elodie-dene-cv.pdf"]')) window.clarity('event', 'cv_download');
        });
    }

    function closeBanner() {
        const banner = document.getElementById('consentBanner');
        if (banner) banner.remove();
    }

    function showBanner() {
        if (document.getElementById('consentBanner')) return;
        const banner = document.createElement('div');
        banner.id = 'consentBanner';
        banner.className = 'consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Cookies de mesure d’audience');
        banner.innerHTML = `
            <p>J’utilise Microsoft Clarity pour comprendre comment ce portfolio est parcouru (pages vues, défilement, clics). Aucune donnée n’est revendue. Vous acceptez ?</p>
            <div class="consent-actions">
                <button type="button" class="consent-btn" data-consent="refuse">Refuser</button>
                <button type="button" class="consent-btn" data-consent="accept">Accepter</button>
            </div>`;
        banner.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-consent]');
            if (!btn) return;
            const accepted = btn.dataset.consent === 'accept';
            saveConsent(accepted);
            closeBanner();
            if (accepted) loadTracker();
            else if (window.clarity) location.reload(); // retrait du consentement : on décharge Clarity
        });
        document.body.appendChild(banner);
    }

    // Lien « Cookies » dans le pied de page pour revenir sur son choix
    document.querySelectorAll('.cta-footer-inner').forEach((footer) => {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'consent-link';
        link.textContent = 'Cookies';
        link.addEventListener('click', showBanner);
        footer.appendChild(link);
    });

    const consent = readConsent();
    if (consent === true) loadTracker();
    else if (consent === null) showBanner();
})();
