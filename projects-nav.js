/* ============================================================
   projects-nav.js — navigation inter-projet (précédent / suivant)
   Source unique de l'ordre : les cards de la page d'accueil.
   Réordonner les cards dans index.html met donc à jour
   automatiquement cette navigation sur toutes les pages projet.
   Les projets sans lien (ex. Japper, carte désactivée) sont
   naturellement exclus : on ne lit que les cards <a>.
   ============================================================ */
(async function () {
    const mount = document.getElementById("project-nav");
    if (!mount) return;

    const here = location.pathname.split("/").pop() || "index.html";

    try {
        const res = await fetch("index.html", { cache: "no-cache" });
        if (!res.ok) throw new Error("index.html introuvable");
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");

        // Ordre = cards projet cliquables de l'accueil, dans l'ordre du DOM
        const projects = [...doc.querySelectorAll(".bento-grid a.showcase-card[href$='.html']")]
            .map((a) => {
                const titleEl = a.querySelector(".showcase-title");
                return {
                    href: a.getAttribute("href"),
                    title: titleEl ? titleEl.textContent.replace(/\s+/g, " ").trim() : "",
                };
            });

        const idx = projects.findIndex((p) => p.href === here);
        if (idx === -1) return; // page absente de la liste (ex. Japper) → pas de nav

        const prev = projects[idx - 1];
        const next = projects[idx + 1];
        if (!prev && !next) return;

        const link = (p, dir) => {
            const cls = dir === "prev" ? "project-nav-prev" : "project-nav-next";
            const label = dir === "prev" ? "← Projet précédent" : "Projet suivant →";
            const a = document.createElement("a");
            a.className = cls;
            a.href = p.href;
            a.innerHTML =
                `<span class="project-nav-dir">${label}</span>` +
                `<span class="project-nav-title"></span>`;
            a.querySelector(".project-nav-title").textContent = p.title;
            return a;
        };

        if (prev) mount.appendChild(link(prev, "prev"));
        if (next) mount.appendChild(link(next, "next"));
    } catch (e) {
        // fetch indisponible (ex. ouverture en file://) → nav laissée vide (masquée via :empty)
    }
})();
