// Menu burger en mobile : ouvre et ferme la liste de liens de la nav
(() => {
    const nav = document.querySelector('nav');
    const toggle = nav && nav.querySelector('.nav-toggle');
    if (!toggle) return;

    function setOpen(open) {
        nav.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    }

    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('nav-open')));
    nav.querySelectorAll('.nav-links a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
    document.addEventListener('click', (e) => !nav.contains(e.target) && setOpen(false));
    window.matchMedia('(max-width: 768px)').addEventListener('change', () => setOpen(false));
})();

// Bouton « retour en haut » : visible après 300 px de défilement
(() => {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    const update = () => btn.classList.toggle('visible', window.scrollY > 300);
    window.addEventListener('scroll', update, { passive: true });
    update();
})();
