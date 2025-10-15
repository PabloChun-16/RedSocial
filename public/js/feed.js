(() => {
  const DEFAULT_ADJUSTMENTS = {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    warmth: 0,
    fade: 0
  };

  const FILTERS = [
    { id: "original", css: "" },
    { id: "aurora", css: "contrast(1.05) saturate(1.18)" },
    { id: "ember", css: "brightness(1.05) saturate(1.2) sepia(0.15)" },
    { id: "midnight", css: "brightness(0.92) contrast(1.12) saturate(0.9)" },
    { id: "solstice", css: "saturate(1.4) hue-rotate(12deg)" },
    { id: "lumen", css: "brightness(1.18) contrast(0.92)" }
  ];

  const FEED_STATE = {
    posts: []
  };

  const AVATAR_DEFAULT = "/media/iconobase.png";
  const AVATAR_FALLBACK =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";

  let feedGrid = null;
  let feedEmpty = null;
  let shell = null;

  function normalizeAssetPath(value, fallbackFolder = ""){
    if(!value) return "";
    const trimmed = value.trim();
    if(!trimmed) return "";
    if(trimmed.toLowerCase() === "default.png" || trimmed.includes("iconobase")){
      return "/media/iconobase.png";
    }
    if(/^https?:\/\//i.test(trimmed)) return trimmed;
    const marker = "uploads/";
    const lower = trimmed.toLowerCase();
    const index = lower.lastIndexOf(marker);
    if(index !== -1){
      const relative = trimmed.slice(index + marker.length).replace(/^[\\/]+/, "");
      return `/uploads/${relative}`;
    }
    const file = trimmed.split(/[\\/]/).pop();
    if(file){
      if(fallbackFolder){
        return `/uploads/${fallbackFolder}/${file}`;
      }
      return `/uploads/${file}`;
    }
    return "";
  }

  function sanitizePublicationForClient(publication = {}){
    const normalizedImage = normalizeAssetPath(publication.image || "", "posts");
    const owner = publication.owner
      ? {
          ...publication.owner,
          image: normalizeAssetPath(publication.owner.image || "", "avatars") || AVATAR_DEFAULT
        }
      : null;
    return {
      ...publication,
      image: normalizedImage || "/media/iconobase.png",
      owner,
      likes: publication.likes ?? 0,
      tags: Array.isArray(publication.tags) ? publication.tags : [],
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...(publication.adjustments || {}) }
    };
  }

  function buildFilterCss(publication){
    const filterDef = FILTERS.find((filter) => filter.id === publication.filter) || FILTERS[0];
    const adjustments = { ...DEFAULT_ADJUSTMENTS, ...(publication.adjustments || {}) };
    const warmthDeg = adjustments.warmth || 0;
    const fadeFactor = 1 - Math.min(Math.max(adjustments.fade || 0, 0), 1) * 0.15;
    return [
      `brightness(${adjustments.brightness || 1})`,
      `contrast(${adjustments.contrast || 1})`,
      `saturate(${adjustments.saturation || 1})`,
      warmthDeg ? `hue-rotate(${warmthDeg}deg)` : "",
      adjustments.fade ? `brightness(${fadeFactor})` : "",
      filterDef.css
    ]
      .filter(Boolean)
      .join(" ");
  }

  function hydrateUserSection(user){
    const storyName = document.getElementById("story-name");
    const storyAvatar = document.getElementById("story-avatar");
    if(!storyName && !storyAvatar) return;

    const nick = user?.nick || user?.username || user?.email?.split("@")[0] || "tú";
    if(storyName){
      storyName.textContent = user?.name?.split(" ")?.[0] || nick;
    }
    if(storyAvatar){
      const avatarUrl = normalizeAssetPath(user?.avatar || user?.image || user?.photo, "avatars") || AVATAR_DEFAULT;
      storyAvatar.src = avatarUrl;
      storyAvatar.alt = user?.name || nick;
      if(window.appShell){
        window.appShell.attachAvatarFallback(storyAvatar);
      }else{
        storyAvatar.addEventListener("error", () => {
          storyAvatar.src = AVATAR_FALLBACK;
        }, { once: true });
      }
    }
  }

  function renderFeed(){
    if(!feedGrid || !feedEmpty) return;
    feedGrid.innerHTML = "";

    if(!FEED_STATE.posts.length){
      feedGrid.hidden = true;
      feedEmpty.hidden = false;
      feedEmpty.style.display = "";
      return;
    }

    feedGrid.hidden = false;
    feedEmpty.hidden = true;
    feedEmpty.style.display = "none";

    FEED_STATE.posts.forEach((post, index) => {
      const normalized = sanitizePublicationForClient(post);
      const ownerImage = normalizeAssetPath(normalized.owner?.image || AVATAR_DEFAULT, "avatars") || AVATAR_DEFAULT;
      const ownerName = normalized.owner?.name?.split?.(" ")?.[0] || normalized.owner?.nick || "Usuario";
      const ownerNick = normalized.owner?.nick ? `@${normalized.owner.nick}` : "";
      const card = document.createElement("article");
      card.className = `post glass swing${index % 3 ? ` delay-${index % 3}` : ""}`;
      card.dataset.id = normalized.id;
      card.innerHTML = `
        <div class="post__header">
          <img src="${ownerImage}" alt="Avatar ${ownerName}" />
          <div>
            <h3>${ownerName}</h3>
            <span>${ownerNick} · ${new Date(normalized.createdAt).toLocaleString()}</span>
          </div>
          <button class="icon-btn icon-more" type="button" aria-label="Opciones"></button>
        </div>
        <figure class="post__media">
          <img src="${normalized.image}" alt="${normalized.caption || "Publicación"}" style="filter:${buildFilterCss(normalized)}" />
        </figure>
        <div class="post__actions">
          <button class="chip like" type="button">♥ ${normalized.likes || 0}</button>
          <button class="chip" type="button">🏷 ${normalized.tags?.length || 0}</button>
          <button class="chip" type="button">💬 0</button>
        </div>
        <p class="post__caption">${normalized.caption || "Sin descripción"}</p>
        <div class="post__hashtags">${
          normalized.tags?.length ? normalized.tags.map((tag) => `#${tag}`).join(" ") : ""
        }</div>
      `;
      card.addEventListener("click", (event) => {
        if(event.target.closest(".chip")) return;
        openPublicationModal(normalized.id);
      });
      feedGrid.appendChild(card);
    });
  }

  async function loadFeed(){
    const token = localStorage.getItem("token");
    if(!token) return;
    try{
      const res = await fetch("/api/publication/feed", {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || `Error ${res.status} al cargar el feed`);
      }
      FEED_STATE.posts = Array.isArray(data.items)
        ? data.items.map(sanitizePublicationForClient)
        : [];
      renderFeed();
    }catch(error){
      console.error(error);
      if(feedEmpty){
        feedEmpty.hidden = false;
        const message = feedEmpty.querySelector("p");
        if(message) message.textContent = error.message;
      }
    }
  }

  async function openPublicationModal(id){
    try{
      const token = localStorage.getItem("token");
      if(!token) return;
      const res = await fetch(`/api/publication/${id}`, {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok) throw new Error(data?.message || "No se pudo abrir la publicación");
      showPublicationDetail(data.publication);
    }catch(error){
      console.error(error);
      alert(error.message || "No se pudo cargar la publicación");
    }
  }

  function showPublicationDetail(publication){
    if(!publication) return;
    const normalized = sanitizePublicationForClient(publication);
    const overlay = document.createElement("div");
    overlay.className = "composer-backdrop is-visible";
    overlay.innerHTML = `
      <div class="composer-modal" style="max-width:900px;">
        <div class="composer-preview" style="background:rgba(0,0,0,.6);">
          <img src="${normalized.image}" alt="${normalized.caption || "Publicación"}" style="filter:${buildFilterCss(normalized)}" />
        </div>
        <div class="composer-panel" style="padding:26px;">
          <header class="composer-head">
            <h2>${normalized.owner?.nick ? `@${normalized.owner.nick}` : "Publicación"}</h2>
            <button type="button" class="composer-close">×</button>
          </header>
          <p>${normalized.caption || "Sin descripción"}</p>
          <div class="hero-meta">
            <span>${new Date(normalized.createdAt).toLocaleString()}</span>
            <span>${normalized.tags?.length || 0} etiquetas</span>
          </div>
          <div class="composer-tags">
            ${
              normalized.tags?.length
                ? normalized.tags.map((tag) => `<span>#${tag}</span>`).join(" ")
                : "<em>Sin etiquetas</em>"
            }
          </div>
        </div>
      </div>
    `;
    overlay.addEventListener("click", (event) => {
      if(event.target === overlay || event.target.classList.contains("composer-close")){
        overlay.remove();
      }
    });
    document.body.appendChild(overlay);
  }

  function startStoriesPulse(){
    const stories = document.querySelectorAll(".story");
    if(!stories.length) return;
    let index = 0;
    setInterval(() => {
      stories.forEach((story, i) => story.classList.toggle("pulse", i === index));
      index = (index + 1) % stories.length;
    }, 4500);
  }

  function initFeed(appShellInstance){
    shell = appShellInstance;
    if(!shell) return;

    feedGrid = document.getElementById("feed-grid");
    feedEmpty = document.getElementById("feed-empty");
    if(!feedGrid || !feedEmpty) return;

    shell.setActiveSidebar("feed");
    shell.setSearchVisibility(true);
    shell.setSearchPlaceholder("Busca usuarios, lugares o momentos");
    shell.setFabVisible(true);

    const currentUser = shell.getUser();
    if(currentUser){
      hydrateUserSection(currentUser);
    }
    shell.onUser(hydrateUserSection);

    startStoriesPulse();
    loadFeed();
  }

  const startFeed = (shellInstance) => {
    if(!shellInstance) return;
    document.removeEventListener("appshell:ready", onAppShellReady);
    initFeed(shellInstance);
  };

  const onAppShellReady = (event) => startFeed(event.detail);

  document.addEventListener("appshell:ready", onAppShellReady);

  if(window.appShell?.isReady){
    startFeed(window.appShell);
  }
})();
