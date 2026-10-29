// Pile de cards en mobile, sur tout élément marqué data-deck : on glisse la card du dessus
// vers la gauche pour voir la suivante (vers la droite pour revenir à la précédente).
// Sur une card lien, un tap ouvre la page. data-deck-hint donne le texte d'aide sous la pile.
(() => {
    const mq = window.matchMedia('(max-width: 768px)');

    function initDeck(grid) {
        const cards = [...grid.children];
        const isLink = cards[0].tagName === 'A';
        const hintText = grid.dataset.deckHint || 'Glissez pour voir la suite';
        const OFFSET = 12;      // décalage vertical entre deux cards de la pile
        const SCALE = 0.04;     // réduction de taille par niveau
        const THRESHOLD = 70;   // distance de glissement pour changer de card

        let order = cards.map((_, i) => i); // order[0] = card du dessus
        let nav = null;
        let dots = [];
        let active = false;

        function layout() {
            cards.forEach((c) => (c.style.height = ''));
            const height = Math.max(...cards.map((c) => c.offsetHeight));
            cards.forEach((c) => (c.style.height = height + 'px'));
            grid.style.height = height + OFFSET * 2 + 'px';

            order.forEach((index, pos) => {
                const card = cards[index];
                card.style.zIndex = cards.length - pos;
                card.style.transform = `translateY(${Math.min(pos, 2) * OFFSET}px) scale(${1 - Math.min(pos, 2) * SCALE})`;
                card.style.opacity = pos > 2 ? '0' : '1';
                if (isLink) card.tabIndex = pos === 0 ? 0 : -1;
                card.setAttribute('aria-hidden', pos === 0 ? 'false' : 'true');
            });
            dots.forEach((d, i) => {
                d.classList.toggle('is-active', i === order[0]);
                d.setAttribute('aria-current', String(i === order[0]));
            });
        }

        function next() {
            order.push(order.shift());
            layout();
        }

        function prev() {
            order.unshift(order.pop());
            layout();
        }

        // Fait sortir la card du dessus de l'écran, puis la renvoie en bas de la pile
        function flyOut(card, direction) {
            card.style.transform = `translateX(${direction * 120}%) rotate(${direction * 12}deg)`;
            card.style.opacity = '0';
            setTimeout(() => {
                card.classList.add('is-dragging');
                direction < 0 ? next() : prev();
                void card.offsetHeight;
                card.classList.remove('is-dragging');
            }, 300);
        }

        // Glissement
        let startX = 0;
        let startY = 0;
        let dx = 0;
        let tracking = false;
        let swiping = false;
        let justSwiped = false;

        function onDown(e) {
            const card = e.currentTarget;
            if (!active || card !== cards[order[0]]) return;
            tracking = true;
            swiping = false;
            dx = 0;
            startX = e.clientX;
            startY = e.clientY;
        }

        function onMove(e) {
            if (!tracking) return;
            const card = e.currentTarget;
            dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!swiping) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                if (Math.abs(dy) > Math.abs(dx)) {
                    tracking = false; // défilement vertical de la page
                    return;
                }
                swiping = true;
                card.setPointerCapture(e.pointerId);
                card.classList.add('is-dragging');
            }
            card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
        }

        function onUp(e) {
            if (!tracking) return;
            tracking = false;
            const card = e.currentTarget;
            if (!swiping) return;
            card.classList.remove('is-dragging');
            swiping = false;
            justSwiped = true;
            setTimeout(() => (justSwiped = false), 50);
            if (Math.abs(dx) > THRESHOLD) {
                flyOut(card, dx < 0 ? -1 : 1);
            } else {
                layout();
            }
        }

        function onCancel(e) {
            if (!tracking) return;
            tracking = false;
            e.currentTarget.classList.remove('is-dragging');
            layout();
        }

        // Un glissement ne doit pas ouvrir le lien
        function onClick(e) {
            if (justSwiped) e.preventDefault();
        }

        function buildNav() {
            nav = document.createElement('div');
            nav.className = 'deck-nav';
            const hint = document.createElement('span');
            hint.className = 'deck-hint';
            hint.textContent = hintText;
            const dotsWrap = document.createElement('div');
            dotsWrap.className = 'deck-dots';
            dots = cards.map((card, i) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'deck-dot';
                dot.setAttribute('aria-label', `Afficher la card ${i + 1} sur ${cards.length}`);
                dot.addEventListener('click', () => {
                    while (order[0] !== i) order.push(order.shift());
                    layout();
                });
                dotsWrap.appendChild(dot);
                return dot;
            });
            nav.append(hint, dotsWrap);
            grid.after(nav);
        }

        function enable() {
            active = true;
            grid.classList.add('is-deck');
            buildNav();
            layout();
        }

        function disable() {
            active = false;
            grid.classList.remove('is-deck');
            grid.style.height = '';
            cards.forEach((c) => {
                ['height', 'zIndex', 'transform', 'opacity'].forEach((p) => (c.style[p] = ''));
                c.removeAttribute('tabindex');
                c.removeAttribute('aria-hidden');
            });
            if (nav) nav.remove();
            nav = null;
            dots = [];
        }

        cards.forEach((card) => {
            card.addEventListener('pointerdown', onDown);
            card.addEventListener('pointermove', onMove);
            card.addEventListener('pointerup', onUp);
            card.addEventListener('pointercancel', onCancel);
            card.addEventListener('click', onClick);
            card.addEventListener('dragstart', (e) => active && e.preventDefault());
        });

        mq.addEventListener('change', () => (mq.matches ? enable() : disable()));
        window.addEventListener('resize', () => active && layout());
        if (document.fonts) document.fonts.ready.then(() => active && layout());
        window.addEventListener('load', () => active && layout());
        if (mq.matches) enable();
    }

    document.querySelectorAll('[data-deck]').forEach(initDeck);
})();
