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

  function normalizeAdjustments(source){
    const normalized = { ...DEFAULT_ADJUSTMENTS };
    if(!source || typeof source !== "object") return normalized;
    Object.keys(normalized).forEach((key) => {
      const value = source[key];
      if(typeof value === "number" && Number.isFinite(value)){
        normalized[key] = value;
      }else if(typeof value === "string" && value.trim() !== ""){
        const parsed = Number.parseFloat(value);
        if(!Number.isNaN(parsed)){
          normalized[key] = parsed;
        }
      }
    });
    return normalized;
  }

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
  let publicationUpdatedHandler = null;

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

  function sanitizePublicationForClient(publication = {}, previous = null){
    if(window.publicationViewer?.normalize){
      return window.publicationViewer.normalize(publication, previous || undefined);
    }
    const normalizedImage =
      normalizeAssetPath(publication.image || previous?.image || "", "posts") ||
      previous?.image ||
      "/media/iconobase.png";
    const ownerSource = publication.owner || previous?.owner;
    const owner = ownerSource
      ? {
          ...ownerSource,
          image: normalizeAssetPath(ownerSource.image || "", "avatars") || AVATAR_DEFAULT
        }
      : null;
    const commentsSource = Array.isArray(publication.comments)
      ? publication.comments
      : Array.isArray(previous?.comments)
      ? previous.comments
      : [];
    return {
      ...previous,
      ...publication,
      image: normalizedImage,
      owner,
      likes:
        typeof publication.likes === "number"
          ? publication.likes
          : typeof previous?.likes === "number"
          ? previous.likes
          : 0,
      liked:
        typeof publication.liked === "boolean"
          ? publication.liked
          : typeof previous?.liked === "boolean"
          ? previous.liked
          : false,
      saved:
        typeof publication.saved === "boolean"
          ? publication.saved
          : typeof previous?.saved === "boolean"
          ? previous.saved
          : false,
      tags: Array.isArray(publication.tags) ? publication.tags : previous?.tags || [],
      comments: commentsSource,
      commentsCount:
        typeof publication.commentsCount === "number"
          ? publication.commentsCount
          : commentsSource.length,
      filter:
        typeof publication.filter === "string" && publication.filter.trim()
          ? publication.filter.trim()
          : previous?.filter || "original",
      adjustments: normalizeAdjustments({
        ...(previous?.adjustments || {}),
        ...(publication.adjustments || {})
      })
    };
  }

  function setCollection(key, items){
    if(!Array.isArray(items)){
      state.collections[key] = [];
      return;
    }
    state.collections[key] = items.map((item) => sanitizePublicationForClient(item));
  }

  function updateCollectionItem(key, publication, { prepend = true } = {}){
    if(!publication || !state.collections[key]) return null;
    const id = publication.id ?? publication._id?.toString?.();
    if(!id) return null;
    const collection = state.collections[key];
    const index = collection.findIndex((item) => item.id === id);
    const current = index !== -1 ? collection[index] : null;
    const normalized = sanitizePublicationForClient(publication, current || undefined);
    if(index !== -1){
      collection[index] = normalized;
    }else if(prepend){
      collection.unshift(normalized);
    }else{
      collection.push(normalized);
    }
    return normalized;
  }

  function removeFromCollection(key, id){
    if(!id || !Array.isArray(state.collections[key])) return;
    const collection = state.collections[key];
    const index = collection.findIndex((item) => item.id === id);
    if(index !== -1){
      collection.splice(index, 1);
    }
  }

  function findPublication(id){
    if(!id) return null;
    for(const key of Object.keys(state.collections)){
      const collection = state.collections[key];
      if(!Array.isArray(collection)) continue;
      const match = collection.find((item) => item.id === id);
      if(match) return match;
    }
    return null;
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
    if(window.publicationViewer?.buildFilterCss){
      return window.publicationViewer.buildFilterCss(publication);
    }
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
    clearGallerySkeleton();
    const key = tab || state.currentTab;
    state.currentTab = key;
    const dataset = state.collections[key] ?? [];
    els.galleryTitle.textContent =
      key === "posts" ? "Publicaciones" : key === "saved" ? "Guardados" : "Etiquetas";

    els.gallery.innerHTML = "";
    const isSavedTab = key === "saved";

    if(dataset.length === 0){
      els.gallery.hidden = true;
      els.galleryEmpty.hidden = false;
      els.galleryEmpty.style.display = "";
      const title = els.galleryEmpty.querySelector("h3");
      const description = els.galleryEmpty.querySelector("p");
      if(isSavedTab){
        if(title) title.textContent = "Aún no guardas publicaciones";
        if(description){
          description.textContent =
            "Cuando guardes contenido de otros creadores aparecerá aquí para que lo revises más tarde.";
        }
        if(els.galleryEmptyCta){
          els.galleryEmptyCta.style.display = "none";
        }
      }else{
        if(title) title.textContent = "Aún no hay nada por aquí";
        if(description){
          description.textContent =
            "Comparte tu primer momento y muestra a tu comunidad lo que te inspira.";
        }
        if(els.galleryEmptyCta){
          els.galleryEmptyCta.style.display = "";
        }
      }
      return;
    }

    els.gallery.hidden = false;
    els.galleryEmpty.hidden = true;
    els.galleryEmpty.style.display = "none";
    if(els.galleryEmptyCta){
      els.galleryEmptyCta.style.display = isSavedTab ? "none" : "";
    }

    dataset.forEach((item) => {
      const card = document.createElement("article");
      card.className = "profile-card";
      card.dataset.id = item.id;
      const imageSrc = normalizeAssetPath(item.image, "posts") || "/media/iconobase.png";
      const filterCss = buildFilterCss(item) || "none";
      const commentsCount =
        typeof item.commentsCount === "number"
          ? item.commentsCount
          : Array.isArray(item.comments)
          ? item.comments.length
          : 0;
      const ownerNick = item.owner?.nick ? `@${item.owner.nick}` : (item.owner?.name || "");
      const ownerLabel =
        isSavedTab && ownerNick
          ? `<span class="profile-card__owner">De ${ownerNick}</span>`
          : "";
      card.innerHTML = `
        <img src="${imageSrc}" alt="${item.caption || "Publicación"}" loading="lazy" style="filter:${filterCss};" />
        <div class="profile-card__overlay">
          <div class="profile-card__meta">
            <span>♥ ${formatNumber(item.likes || 0)}</span>
            <span>💬 ${formatNumber(commentsCount)}</span>
          </div>
          ${ownerLabel}
        </div>
      `;
      card.addEventListener("click", () => openPublicationModal(item.id));
      els.gallery.appendChild(card);
    });
  }

  function buildGallerySkeletonItem(index){
    if(!els.gallery) return null;
    const card = document.createElement("article");
    card.className = "profile-card profile-card--skeleton";
    card.setAttribute("aria-hidden", "true");
    card.tabIndex = -1;
    card.dataset.index = index.toString();
    card.innerHTML = '<span class="skeleton skeleton--tile"></span>';
    return card;
  }

  function showGallerySkeleton(count = 6){
    if(!els.gallery) return;
    const total = Number.isFinite(count) && count > 0 ? count : 6;
    els.gallery.hidden = false;
    els.gallery.classList.add("is-skeleton");
    els.gallery.setAttribute("aria-busy", "true");
    els.gallery.dataset.state = "loading";
    els.gallery.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for(let i = 0; i < total; i += 1){
      const skeleton = buildGallerySkeletonItem(i);
      if(skeleton) fragment.appendChild(skeleton);
    }
    els.gallery.appendChild(fragment);
    if(els.galleryEmpty){
      els.galleryEmpty.hidden = true;
    }
  }

  function clearGallerySkeleton(){
    if(!els.gallery) return;
    if(els.gallery.dataset.state === "loading"){
      delete els.gallery.dataset.state;
      els.gallery.innerHTML = "";
    }
    els.gallery.classList.remove("is-skeleton");
    els.gallery.removeAttribute("aria-busy");
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
    showGallerySkeleton();
    try{
      const [ownRes, savedRes] = await Promise.all([
        fetch("/api/publication/user/me", {
          headers: { Authorization: token }
        }),
        fetch("/api/publication/saved", {
          headers: { Authorization: token }
        })
      ]);

      const ownData = await ownRes.json().catch(() => ({}));
      if(!ownRes.ok){
        throw new Error(ownData?.message || `Error ${ownRes.status} al cargar publicaciones`);
      }
      setCollection("posts", Array.isArray(ownData.items) ? ownData.items : []);
      state.collections.tagged = state.collections.tagged || [];

      let savedItems = [];
      if(savedRes.ok){
        const savedData = await savedRes.json().catch(() => ({}));
        savedItems = Array.isArray(savedData.items) ? savedData.items : [];
      }
      setCollection("saved", savedItems);

      if(els.postsCount){
        els.postsCount.textContent = state.collections.posts.length.toString();
      }
      renderGallery(state.currentTab);
    }catch(error){
      console.error(error);
    }finally{
      clearGallerySkeleton();
    }
  }

  function openPublicationModal(id){
    if(!window.publicationViewer) return;
    const found = findPublication(id);
    if(found){
      window.publicationViewer.open(found);
    }
    window.publicationViewer.openById(id);
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

    if(publicationUpdatedHandler){
      document.removeEventListener("publication:updated", publicationUpdatedHandler);
    }
    publicationUpdatedHandler = (event) => {
      const publication = event.detail;
      if(!publication?.id) return;
      const normalized = sanitizePublicationForClient(publication);
      const currentUserId = shell?.getUser?.()?.id;
      const isOwn =
        normalized.owner?.id && currentUserId && normalized.owner.id === currentUserId;

      if(isOwn){
        updateCollectionItem("posts", normalized, { prepend: true });
        if(els.postsCount){
          els.postsCount.textContent = state.collections.posts.length.toString();
        }
      }

      if(typeof normalized.saved === "boolean"){
        if(normalized.saved){
          updateCollectionItem("saved", normalized, { prepend: true });
        }else{
          removeFromCollection("saved", normalized.id);
        }
      }

      if((isOwn && state.currentTab === "posts") || state.currentTab === "saved"){
        renderGallery(state.currentTab);
      }
    };
    document.addEventListener("publication:updated", publicationUpdatedHandler);

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
      if(!publication?.isOwn) return;
      updateCollectionItem("posts", publication, { prepend: true });
      if(els.postsCount){
        els.postsCount.textContent = state.collections.posts.length.toString();
      }
      if(state.currentTab === "posts"){
        renderGallery(state.currentTab);
      }
    });
  }
})();
