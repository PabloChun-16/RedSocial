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
      adjustments: {
        ...DEFAULT_ADJUSTMENTS,
        ...(previous?.adjustments || {}),
        ...(publication.adjustments || {})
      }
    };
  }

  function buildFilterCss(publication){
    if(window.publicationViewer?.buildFilterCss){
      return window.publicationViewer.buildFilterCss(publication);
    }
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
      const ownerImage =
        normalizeAssetPath(normalized.owner?.image || AVATAR_DEFAULT, "avatars") ||
        AVATAR_DEFAULT;
      const ownerName =
        normalized.owner?.name?.split?.(" ")?.[0] || normalized.owner?.nick || "Usuario";
      const ownerNick = normalized.owner?.nick ? `@${normalized.owner.nick}` : "";
      const createdAt = normalized.createdAt ? new Date(normalized.createdAt) : null;
      const card = document.createElement("article");
      card.className = `post glass swing${index % 3 ? ` delay-${index % 3}` : ""}`;
      card.dataset.id = normalized.id;
      const isOwn = Boolean(
        normalized.isOwn ||
        (normalized.owner?.id && shell?.getUser?.()?.id && normalized.owner.id === shell.getUser().id)
      );
      card.innerHTML = `
        <div class="post__header">
          <img src="${ownerImage}" alt="Avatar ${ownerName}" />
          <div>
            <h3>${ownerName}</h3>
            <span>${ownerNick} · ${new Date(normalized.createdAt).toLocaleString()}</span>
          </div>
          <button class="post__more-btn" type="button" aria-label="Opciones" ${isOwn ? "" : "hidden"}>
            <span class="icon icon-more" aria-hidden="true"></span>
          </button>
        </div>
        <figure class="post__media">
          <img src="${normalized.image}" alt="${normalized.caption || "Publicación"}" style="filter:${buildFilterCss(normalized)}" />
        </figure>
        <div class="post__actions">
          <button class="chip like${normalized.liked ? " is-active" : ""}" type="button" data-action="like" aria-pressed="${normalized.liked ? "true" : "false"}">♥ ${normalized.likes || 0}</button>
          <button class="chip comment" type="button" data-action="comments">💬 ${normalized.commentsCount || 0}</button>
          <button class="chip save${normalized.saved ? " is-active" : ""}" type="button" data-action="save">${normalized.saved ? "🔖 Guardado" : "📌 Guardar"}</button>
        </div>
        <p class="post__caption">${normalized.caption || "Sin descripción"}</p>
        <div class="post__hashtags">${
          normalized.tags?.length ? normalized.tags.map((tag) => `#${tag}`).join(" ") : ""
        }</div>
      `;
      const avatarImg = card.querySelector(".post__header img");
      if(avatarImg){
        avatarImg.alt = `Avatar ${ownerName}`;
        if(window.appShell){
          window.appShell.attachAvatarFallback(avatarImg);
        }else{
          avatarImg.addEventListener("error", () => {
            avatarImg.src = AVATAR_FALLBACK;
          }, { once: true });
        }
      }
      const dateLabel = card.querySelector(".post__header span");
      if(dateLabel && createdAt){
        dateLabel.textContent = `${ownerNick || ownerName} · ${createdAt.toLocaleString()}`;
      }
      // menú contextual para publicación propia
      if(isOwn){
        const headerEl = card.querySelector(".post__header");
        const moreBtn = headerEl?.querySelector(".post__more-btn");
        if(moreBtn){
          const menu = document.createElement("div");
          menu.className = "post__menu";
          menu.innerHTML = `
            <button class="post__menu-item" data-action="delete">
              <span class="icon icon-trash" aria-hidden="true"></span>
              <span>Eliminar</span>
            </button>`;
          headerEl.appendChild(menu);
          const closeMenu = (e) => {
            if(menu.style.display !== "block") return;
            if(!headerEl.contains(e.target)){
              menu.style.display = "none";
              document.removeEventListener("click", closeMenu, { capture: true });
            }
          };
          moreBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === "block" ? "none" : "block";
            if(menu.style.display === "block"){
              document.addEventListener("click", closeMenu, { capture: true });
            }
          });
          menu.addEventListener("click", async (e) => {
            const del = e.target.closest('[data-action="delete"]');
            if(!del) return;
            e.stopPropagation();
            menu.style.display = "none";
            const ok = await showConfirm({
              title: "Eliminar publicación",
              message: "¿Seguro que deseas eliminarla? Esta acción no se puede deshacer.",
              confirmText: "Eliminar",
              cancelText: "Cancelar",
              danger: true
            });
            if(!ok) return;
            await deletePost(normalized.id);
          });
        }
      }

      card.addEventListener("click", (event) => {
        const actionBtn = event.target.closest("[data-action]");
        if(actionBtn){
          event.preventDefault();
          event.stopPropagation();
          handlePostAction(actionBtn.dataset.action, normalized.id, actionBtn);
          return;
        }
        if(event.target.closest(".post__more-btn")) return;
        openPublicationModal(normalized.id);
      });
      feedGrid.appendChild(card);
    });
  }

  // Confirmación reutilizable (estética acorde al compositor)
  function showConfirm({ title = "Confirmar", message = "", confirmText = "Aceptar", cancelText = "Cancelar", danger = false } = {}){
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "confirm-backdrop composer-backdrop";
      const theme = document.body.classList.contains("theme-day") ? "day" : (window.appShell?.getTheme?.() || "night");
      if(theme === "day") backdrop.classList.add("is-day");
      backdrop.innerHTML = `
        <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="confirm-icon">⚠️</div>
          <h3 id="confirm-title" class="confirm-title">${title}</h3>
          <p class="confirm-message">${message}</p>
          <div class="confirm-actions">
            <button type="button" class="btn-cancel">${cancelText}</button>
            <button type="button" class="btn-confirm${danger ? " is-danger" : ""}">${confirmText}</button>
          </div>
        </div>`;
      const cleanup = (result) => {
        document.removeEventListener("keydown", onKey);
        backdrop.classList.remove("is-visible");
        setTimeout(() => backdrop.remove(), 160);
        resolve(result);
      };
      const onKey = (e) => {
        if(e.key === "Escape") cleanup(false);
        if(e.key === "Enter") cleanup(true);
      };
      backdrop.addEventListener("click", (e) => { if(e.target === backdrop) cleanup(false); });
      const cancelBtn = backdrop.querySelector(".btn-cancel");
      const confirmBtn = backdrop.querySelector(".btn-confirm");
      cancelBtn.addEventListener("click", () => cleanup(false));
      confirmBtn.addEventListener("click", () => cleanup(true));
      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add("is-visible"));
      confirmBtn.focus();
      document.addEventListener("keydown", onKey);
    });
  }

  async function deletePost(id){
    const token = getToken();
    if(!token || !id) return;
    try{
      const res = await fetch(`/api/publication/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: token }
      });
      const json = await res.json().catch(() => ({}));
      if(!res.ok){
        await showConfirm({ title: "No se pudo eliminar", message: json?.message || `Error ${res.status}`, confirmText: "Entendido", cancelText: "" });
        return;
      }
      const idx = FEED_STATE.posts.findIndex((p) => p.id === id);
      if(idx !== -1){
        FEED_STATE.posts.splice(idx, 1);
        renderFeed();
      }
      // Notificar a otros componentes
      const evt = new CustomEvent("publication:deleted", { detail: { id } });
      document.dispatchEvent(evt);
      try{ window.dispatchEvent(evt); }catch(_e){}
      // Recarga rápida para asegurar sincronización global
      setTimeout(() => {
        try{ window.location.reload(); }catch(_err){}
      }, 120);
    }catch(error){
      console.error(error);
      await showConfirm({ title: "Error", message: "No se pudo eliminar la publicación.", confirmText: "Cerrar", cancelText: "" });
    }
  }

  function findPost(id){
    if(!id) return null;
    return FEED_STATE.posts.find((post) => post.id === id) || null;
  }

  function updatePostInState(publication, { prepend = true } = {}){
    if(!publication) return null;
    const targetId = publication.id ?? publication._id?.toString?.();
    if(!targetId) return null;
    const index = FEED_STATE.posts.findIndex((post) => post.id === targetId);
    const current = index !== -1 ? FEED_STATE.posts[index] : null;
    const normalized = sanitizePublicationForClient(publication, current || undefined);
    if(index !== -1){
      FEED_STATE.posts[index] = normalized;
    }else if(prepend){
      FEED_STATE.posts.unshift(normalized);
    }else{
      FEED_STATE.posts.push(normalized);
    }
    return normalized;
  }

  function getToken(){
    return localStorage.getItem("token");
  }

  function handlePostAction(action, id, trigger){
    if(!id) return;
    if(action === "like"){
      toggleLike(id, trigger);
      return;
    }
    if(action === "comments"){
      openPublicationModal(id);
      return;
    }
    if(action === "save"){
      toggleSave(id, trigger);
    }
  }

  async function toggleLike(id, trigger){
    const token = getToken();
    if(!token) return;
    const post = findPost(id);
    if(!post) return;
    if(trigger){
      trigger.disabled = true;
    }
    try{
      const res = await fetch(`/api/publication/${id}/likes`, {
        method: post.liked ? "DELETE" : "POST",
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo actualizar el like");
      }
      if(data?.publication){
        const normalized = updatePostInState(data.publication);
        document.dispatchEvent(new CustomEvent("publication:updated", { detail: normalized }));
      }
    }catch(error){
      console.error(error);
      alert(error.message || "No se pudo actualizar el like");
    }finally{
      if(trigger && trigger.isConnected){
        trigger.disabled = false;
      }
    }
  }

  async function toggleSave(id, trigger){
    const token = getToken();
    if(!token) return;
    const post = findPost(id);
    if(!post) return;
    if(trigger){
      trigger.disabled = true;
    }
    try{
      const res = await fetch(`/api/publication/${id}/save`, {
        method: post.saved ? "DELETE" : "POST",
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo actualizar el guardado");
      }
      if(data?.publication){
        const normalized = updatePostInState(data.publication);
        document.dispatchEvent(new CustomEvent("publication:updated", { detail: normalized }));
      }
    }catch(error){
      console.error(error);
      alert(error.message || "No se pudo actualizar el guardado");
    }finally{
      if(trigger && trigger.isConnected){
        trigger.disabled = false;
      }
    }
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
      FEED_STATE.posts = [];
      if(Array.isArray(data.items)){
        data.items.forEach((item) => updatePostInState(item, { prepend: false }));
      }
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

  function openPublicationModal(id){
    if(!window.publicationViewer) return;
    const existing = findPost(id);
    if(existing){
      window.publicationViewer.open(existing);
    }
    window.publicationViewer.openById(id);
  }

  document.addEventListener("publication:updated", (event) => {
    const publication = event.detail;
    if(!publication?.id) return;
    updatePostInState(publication);
    renderFeed();
  });

  // Cuando una publicación es eliminada desde el visor, actualizar el feed
  document.addEventListener("publication:deleted", (event) => {
    const id = event?.detail?.id;
    if(!id) return;
    const idx = FEED_STATE.posts.findIndex((p) => p.id === id);
    if(idx !== -1){
      FEED_STATE.posts.splice(idx, 1);
      renderFeed();
    }
  });

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

    if(window.postComposer){
      window.postComposer.registerListener((publication) => {
        if(!publication) return;
        updatePostInState(publication);
        renderFeed();
      });
    }
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
