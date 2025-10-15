(() => {
  const AVATAR_DEFAULT = "/media/iconobase.png";
  const AVATAR_FALLBACK =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";

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

  const HIGHLIGHTS = [
    {
      title: "Roadtrip",
      meta: "Hace 4 semanas",
      image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=facearea&w=200&q=80"
    },
    {
      title: "Moodboard",
      meta: "Hace 2 semanas",
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=facearea&w=200&q=80"
    },
    {
      title: "Sketchbook",
      meta: "Hace 3 días",
      image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80"
    },
    {
      title: "Playlist",
      meta: "Hoy",
      image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80"
    }
  ];

  const state = {
    collections: {
      posts: [],
      saved: [],
      tagged: []
    },
    currentTab: "posts"
  };

  const els = {};
  let shell = null;

  function setRefs(){
    els.heroAvatar = document.getElementById("profile-hero-avatar");
    els.heroEditBtn = document.getElementById("hero-edit-btn");
    els.profileUsername = document.getElementById("profile-username");
    els.profileFullname = document.getElementById("profile-fullname");
    els.profileTagline = document.getElementById("profile-tagline");
    els.profileRole = document.getElementById("profile-role");
    els.profileBio = document.getElementById("profile-bio");
    els.editMuralBtn = document.getElementById("edit-mural-btn");
    els.postsCount = document.getElementById("profile-posts-count");
    els.followersCount = document.getElementById("profile-followers-count");
    els.followingCount = document.getElementById("profile-following-count");
    els.highlightRail = document.getElementById("highlight-rail");
    els.tabs = Array.from(document.querySelectorAll(".tab"));
    els.galleryTitle = document.getElementById("gallery-title");
    els.gallery = document.getElementById("profile-grid");
    els.galleryEmpty = document.getElementById("profile-empty");
    els.galleryEmptyCta = els.galleryEmpty?.querySelector("button") ?? null;
    els.newPostBtn = document.getElementById("new-post-btn");
  }

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

  function attachAvatarFallback(img){
    if(!img) return;
    if(shell){
      shell.attachAvatarFallback(img);
    }else{
      img.addEventListener("error", () => {
        img.src = AVATAR_FALLBACK;
      }, { once: true });
    }
  }

  function formatNumber(value){
    if(typeof value !== "number") value = Number(value) || 0;
    if(value >= 1000){
      const thousands = value / 1000;
      return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
    }
    return `${value}`;
  }

  function applyUser(user){
    if(!user) return;
    const nick = user.nick || user.username || user.email?.split("@")[0] || "usuario";
    const fullName = user.name ? `${user.name}${user.surname ? ` ${user.surname}` : ""}` : nick;
    const avatarUrl = normalizeAssetPath(user.avatar || user.image || user.photo, "avatars") || AVATAR_DEFAULT;

    if(els.profileUsername) els.profileUsername.textContent = `@${nick}`;
    if(els.profileFullname) els.profileFullname.textContent = fullName;
    if(els.profileTagline) els.profileTagline.textContent = `Momentos de @${nick}`;
    if(els.profileRole) els.profileRole.textContent = user.role ? user.role.replace(/_/g, " ") : "Miembro LuminA";
    if(els.profileBio){
      els.profileBio.textContent = user.bio || "Personaliza tu historia: comparte momentos, colecciona recuerdos y mantente cerca de tu círculo creativo.";
    }

    const stats = {
      posts: user.stats?.posts ?? state.collections.posts.length,
      followers: user.stats?.followers ?? user.followers ?? 0,
      following: user.stats?.following ?? user.following ?? 0
    };
    if(els.postsCount) els.postsCount.textContent = stats.posts.toString();
    if(els.followersCount) els.followersCount.textContent = formatNumber(stats.followers);
    if(els.followingCount) els.followingCount.textContent = formatNumber(stats.following);

    if(els.heroAvatar){
      els.heroAvatar.src = avatarUrl;
      els.heroAvatar.alt = fullName;
      attachAvatarFallback(els.heroAvatar);
    }
  }

  function renderHighlights(){
    if(!els.highlightRail) return;
    els.highlightRail.innerHTML = "";
    HIGHLIGHTS.forEach((item) => {
      const card = document.createElement("article");
      card.className = "highlight-card";
      card.innerHTML = `
        <div class="highlight-thumb">
          <img src="${item.image}" alt="${item.title}" loading="lazy" />
        </div>
        <span class="highlight-title">${item.title}</span>
        <span class="highlight-meta">${item.meta}</span>
      `;
      els.highlightRail.appendChild(card);
    });
  }

  function buildFilterCss(publication){
    const filterDef = FILTERS.find((f) => f.id === publication.filter) || FILTERS[0];
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

  function renderGallery(tab){
    if(!els.gallery || !els.galleryTitle || !els.galleryEmpty) return;
    const key = tab || state.currentTab;
    state.currentTab = key;
    const dataset = state.collections[key] ?? [];
    els.galleryTitle.textContent =
      key === "posts" ? "Publicaciones" : key === "saved" ? "Guardados" : "Etiquetas";

    els.gallery.innerHTML = "";
    if(dataset.length === 0){
      els.gallery.hidden = true;
      els.galleryEmpty.hidden = false;
      els.galleryEmpty.style.display = "";
      return;
    }

    els.gallery.hidden = false;
    els.galleryEmpty.hidden = true;
    els.galleryEmpty.style.display = "none";

    dataset.forEach((item) => {
      const card = document.createElement("article");
      card.className = "profile-card";
      card.dataset.id = item.id;
      const imageSrc = normalizeAssetPath(item.image, "posts") || "/media/iconobase.png";
      card.innerHTML = `
        <img src="${imageSrc}" alt="${item.caption || "Publicación"}" loading="lazy" />
        <div class="profile-card__overlay">
          <div class="profile-card__meta">
            <span>♥ ${formatNumber(item.likes || 0)}</span>
            <span>🏷 ${item.tags?.length || 0}</span>
          </div>
        </div>
      `;
      card.addEventListener("click", () => openPublicationModal(item.id));
      els.gallery.appendChild(card);
    });
  }

  function initTabs(){
    els.tabs?.forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.dataset.tab;
        if(!key) return;
        els.tabs.forEach((btn) => btn.classList.toggle("is-active", btn === tab));
        renderGallery(key);
      });
    });
    renderGallery(state.currentTab);
  }

  function initHighlights(){
    renderHighlights();
  }

  function wireEvents(){
    els.editMuralBtn?.addEventListener("click", enableMuralEdit);
    els.heroEditBtn?.addEventListener("click", () => {
      window.location.href = "/profile-edit.html";
    });
    els.newPostBtn?.addEventListener("click", () => {
      window.postComposer?.open();
    });
    els.galleryEmptyCta?.addEventListener("click", () => {
      window.postComposer?.open();
    });
  }

  function enableMuralEdit(){
    if(!els.profileBio) return;
    document.getElementById("mural-save-banner")?.remove();
    els.profileBio.contentEditable = "true";
    els.profileBio.focus();
    els.profileBio.classList.add("is-editing");
    const saveNotice = document.createElement("div");
    saveNotice.className = "composer-tags";
    saveNotice.id = "mural-save-banner";
    saveNotice.innerHTML = `<span>Escribe tu mural y presiona Enter o haz clic fuera para guardar.</span>`;
    els.profileBio.insertAdjacentElement("afterend", saveNotice);

    const saveHandler = () => {
      els.profileBio.contentEditable = "false";
      els.profileBio.classList.remove("is-editing");
      document.getElementById("mural-save-banner")?.remove();
      els.profileBio.removeEventListener("blur", saveHandler);
      els.profileBio.removeEventListener("keydown", keyHandler);
      const text = els.profileBio.textContent.trim();
      const finalText = text || "Personaliza tu historia: comparte momentos, colecciona recuerdos y mantente cerca de tu círculo creativo.";
      els.profileBio.textContent = finalText;
      saveMural(finalText);
    };

    const keyHandler = (event) => {
      if(event.key === "Enter"){
        event.preventDefault();
        els.profileBio.blur();
      }
    };

    els.profileBio.addEventListener("blur", saveHandler);
    els.profileBio.addEventListener("keydown", keyHandler);
  }

  async function saveMural(text){
    const token = localStorage.getItem("token");
    if(!token){
      window.location.replace("/index.html");
      return;
    }
    try{
      const formData = new FormData();
      formData.append("bio", text);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { Authorization: token },
        body: formData
      });
      if(!res.ok){
        console.warn("No se pudo guardar el mural");
        return;
      }
      const currentUser = shell?.getUser();
      if(currentUser){
        shell.setUser({ ...currentUser, bio: text });
      }
    }catch(error){
      console.warn("Error al guardar mural", error);
    }
  }

  async function fetchUserPublications(){
    const token = localStorage.getItem("token");
    if(!token) return;
    try{
      const res = await fetch("/api/publication/user/me", {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || `Error ${res.status} al cargar publicaciones`);
      }
      state.collections.posts = Array.isArray(data.items)
        ? data.items.map(sanitizePublicationForClient)
        : [];
      state.collections.saved = [];
      state.collections.tagged = [];
      if(els.postsCount) els.postsCount.textContent = state.collections.posts.length.toString();
      renderGallery(state.currentTab);
    }catch(error){
      console.error(error);
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

  function initProfile(appShell){
    shell = appShell;
    if(!shell) return;

    setRefs();

    shell.setActiveSidebar("profile");
    shell.setSearchVisibility(true);
    shell.setSearchPlaceholder("Busca momentos, creadores o etiquetas");
    shell.setFabVisible(true);

    attachAvatarFallback(els.heroAvatar);

    shell.onUser(applyUser);
    const currentUser = shell.getUser();
    if(currentUser){
      applyUser(currentUser);
    }

    initHighlights();
    initTabs();
    wireEvents();

    shell.refreshUserFromApi();
    fetchUserPublications();
  }

  const startProfile = (shellInstance) => {
    if(!shellInstance) return;
    document.removeEventListener("appshell:ready", onAppShellReady);
    initProfile(shellInstance);
  };

  const onAppShellReady = (event) => startProfile(event.detail);

  document.addEventListener("appshell:ready", onAppShellReady);

  if(window.appShell?.isReady){
    startProfile(window.appShell);
  }

  if(window.postComposer){
    window.postComposer.registerListener((publication) => {
      if(publication?.isOwn){
        state.collections.posts.unshift(sanitizePublicationForClient(publication));
        if(els.postsCount) els.postsCount.textContent = state.collections.posts.length.toString();
        renderGallery(state.currentTab);
      }
    });
  }
})();
