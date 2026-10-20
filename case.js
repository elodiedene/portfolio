// Pages projet (.page-case) : onglets (décisions, principes) et animations au scroll
(() => {
    // Onglets : un seul panneau visible, le premier par défaut ; sans JS, tous restent visibles.
    // Chaque groupe (décisions clés, principes de conception) fonctionne indépendamment.
    function setupTabs(tabs) {
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
    }

    document.querySelectorAll('[role="tablist"]').forEach((list) => {
        setupTabs([...list.querySelectorAll('[role="tab"]')]);
    });

    // Animations : rien si l'utilisateur préfère réduire les mouvements (état final affiché)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const targets = [...document.querySelectorAll('[data-reveal], [data-bar], [data-count]')];

    // Courbe : on cache le tracé avant d'activer la transition. Safari observe mal les éléments
    // internes d'un SVG, donc on observe le <svg> lui-même et on retrouve le tracé à partir de lui.
    const drawPaths = new Map();
    document.querySelectorAll('[data-draw]').forEach((path) => {
        let length;
        try { length = path.getTotalLength(); } catch (e) { return; }
        if (!length) return;
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        drawPaths.set(path.ownerSVGElement, path);
        targets.push(path.ownerSVGElement);
    });

    // L'état caché n'existe qu'avec cette classe : sans JS, tout reste visible
    document.documentElement.classList.add('cs-motion');

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
            if (drawPaths.has(el)) drawPaths.get(el).style.strokeDashoffset = 0;
            if (el.hasAttribute('data-count')) count(el);
        });
    }, { threshold: 0.15 });

    targets.forEach((el) => observer.observe(el));
})();
