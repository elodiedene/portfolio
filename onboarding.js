// Page projet onboarding : onglets des décisions clés et animations au scroll
(() => {
    // Onglets : une seule décision visible, 01 par défaut
    const tabs = [...document.querySelectorAll('.ob-tab')];

    function select(tab, focus) {
        tabs.forEach((t) => {
            const on = t === tab;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
        if (focus) tab.focus();
    }

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', (e) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (step) {
                e.preventDefault();
                select(tabs[(i + step + tabs.length) % tabs.length], true);
            } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                select(tabs[e.key === 'Home' ? 0 : tabs.length - 1], true);
            }
        });
    });
    if (tabs.length) select(tabs[0]);

    // Animations : rien si l'utilisateur préfère réduire les mouvements (état final affiché)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const targets = document.querySelectorAll('[data-reveal], [data-bar], [data-barh], [data-draw], [data-count]');

    // Courbe : on cache le tracé avant d'activer la transition
    document.querySelectorAll('[data-draw]').forEach((path) => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
    });

    // L'état caché n'existe qu'avec cette classe : sans JS, tout reste visible
    document.documentElement.classList.add('ob-motion');

    function count(el) {
        const to = parseFloat(el.dataset.count);
        const dec = Number(el.dataset.dec || 0);
        const suffix = el.dataset.suffix || '';
        const t0 = performance.now();
        const tick = (now) => {
            const p = Math.min(1, (now - t0) / 1400);
            const v = to * (1 - Math.pow(1 - p, 3));
            el.textContent = v.toFixed(dec).replace('.', ',') + suffix;
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            observer.unobserve(el);
            el.classList.add('is-in');
            if (el.hasAttribute('data-draw')) el.style.strokeDashoffset = 0;
            if (el.hasAttribute('data-count')) count(el);
        });
    }, { threshold: 0.15 });

    targets.forEach((el) => observer.observe(el));
})();
