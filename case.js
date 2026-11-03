// Pages projet (.page-case) : onglets (décisions, principes) et animations au scroll
(() => {
    // Onglets : un seul panneau visible, le premier par défaut ; sans JS, tous restent visibles.
    // Chaque groupe (décisions clés, principes de conception) fonctionne indépendamment.
    // En mobile, le groupe devient un accordéon : chaque panneau s'ouvre sous sa ligne et se replie.
    const accordionMq = window.matchMedia('(max-width: 768px)');

    function setupTabs(list) {
        const tabs = [...list.querySelectorAll('[role="tab"]')];
        if (!tabs.length) return;
        const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
        const panelsHome = panels[0].parentElement;
        let current = 0; // onglet sélectionné, ou panneau ouvert en accordéon (-1 : tout replié)
        let accordion = false;

        function render() {
            tabs.forEach((t, i) => {
                const on = i === current;
                panels[i].hidden = !on;
                if (accordion) {
                    t.setAttribute('aria-expanded', String(on));
                    t.tabIndex = 0;
                } else {
                    t.setAttribute('aria-selected', String(on));
                    t.tabIndex = on ? 0 : -1;
                }
            });
        }

        // Accordéon : chaque panneau est déplacé juste après sa ligne ; on le remet en place sinon
        function setMode() {
            accordion = accordionMq.matches;
            list.classList.toggle('is-accordion', accordion);
            list.setAttribute('role', accordion ? 'group' : 'tablist');
            tabs.forEach((t, i) => {
                if (accordion) {
                    t.removeAttribute('role');
                    t.removeAttribute('aria-selected');
                    panels[i].setAttribute('role', 'region');
                    t.after(panels[i]);
                } else {
                    t.setAttribute('role', 'tab');
                    t.removeAttribute('aria-expanded');
                    panels[i].setAttribute('role', 'tabpanel');
                    panelsHome.appendChild(panels[i]);
                }
            });
            current = accordion ? -1 : Math.max(current, 0); // accordéon : tout replié par défaut
            render();
        }

        function select(i, focus) {
            current = i;
            render();
            if (focus) tabs[i].focus();
        }

        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => {
                if (!accordion) return select(i);
                select(current === i ? -1 : i);
            });
            tab.addEventListener('keydown', (e) => {
                if (accordion) return;
                const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
                if (step) {
                    e.preventDefault();
                    select((i + step + tabs.length) % tabs.length, true);
                } else if (e.key === 'Home' || e.key === 'End') {
                    e.preventDefault();
                    select(e.key === 'Home' ? 0 : tabs.length - 1, true);
                }
            });
        });
        accordionMq.addEventListener('change', setMode);
        setMode();
    }

    document.querySelectorAll('[role="tablist"]').forEach(setupTabs);

    // Filtres d'écrans : atténuent les écrans hors sélection, sans les retirer du carrousel
    // (en mobile, le CSS les masque : on revient alors au début du carrousel)
    document.querySelectorAll('.cs-filters').forEach((group) => {
        const buttons = [...group.querySelectorAll('[data-filter]')];
        const carousel = group.parentElement.querySelector('.cs-flow');
        const cards = [...group.parentElement.querySelectorAll('[data-tag]')];
        buttons.forEach((button) => {
            button.addEventListener('click', () => {
                const tag = button.dataset.filter;
                buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
                cards.forEach((card) => card.classList.toggle('is-dimmed', tag !== 'all' && card.dataset.tag !== tag));
                if (accordionMq.matches && carousel) carousel.scrollTo({ left: 0 });
            });
        });
    });

    // Benchmark en pastilles : le détail de la pastille survolée ou touchée s'affiche sous la matrice
    document.querySelectorAll('.cmp').forEach((cmp) => {
        const detail = cmp.querySelector('.cmp-detail');
        const dots = [...cmp.querySelectorAll('button.cmp-dot')];
        function show(dot) {
            dots.forEach((d) => d.classList.toggle('is-active', d === dot));
            const criterion = dot.closest('tr').querySelector('th').firstChild.textContent;
            const label = document.createElement('span');
            label.className = 'cmp-detail-label';
            label.textContent = `${dot.dataset.tool} · ${criterion}`;
            detail.replaceChildren(label, dot.dataset.detail);
        }
        dots.forEach((dot) => {
            dot.addEventListener('click', () => show(dot));
            dot.addEventListener('mouseenter', () => show(dot));
            dot.addEventListener('focus', () => show(dot));
        });
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
