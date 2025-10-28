(() => {
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

  const AVATAR_FALLBACK =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";

  const state = {
    overlay: null,
    modal: null,
    publication: null,
    refs: {},
    isVisible: false
  };

  const relativeTime = typeof Intl !== "undefined" && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat("es", { numeric: "auto" })
    : null;

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

  function attachAvatarFallback(img){
    if(!img) return;
    if(window.appShell?.attachAvatarFallback){
      window.appShell.attachAvatarFallback(img);
      return;
    }
    img.addEventListener("error", () => {
      img.src = AVATAR_FALLBACK;
    }, { once: true });
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

  function normalizeUser(user){
    if(!user) return null;
    const source =
      typeof user.toObject === "function" ? user.toObject({ virtuals: false }) : user;
    if(typeof source === "string"){
      return { id: source, image: "/media/iconobase.png" };
    }
    if(typeof source === "object" && source !== null){
      const id = source._id?.toString?.() ?? source.id ?? null;
      const nick = source.nick || source.username || "";
      const name = source.name || "";
      const image =
        normalizeAssetPath(source.image || source.avatar || "", "avatars") ||
        "/media/iconobase.png";
      return {
        id,
        nick,
        name,
        image
      };
    }
    return null;
  }

  function normalizeComment(comment, ownerId){
    if(!comment) return null;
    const source =
      typeof comment.toObject === "function" ? comment.toObject({ virtuals: false }) : comment;
    const author = normalizeUser(source.author || source.user);
    const isCreator = source.isCreator ?? (author?.id && ownerId ? author.id === ownerId : false);
    return {
      id: source._id?.toString?.() ?? source.id ?? `${source.createdAt || Date.now()}`,
      text: source.text || "",
      createdAt: source.createdAt || null,
      author,
      isCreator
    };
  }

  function getCurrentUserId(){
    return window.appShell?.getUser?.()?.id || null;
  }

  function buildProfileUrl(user){
    if(!user) return "/profile.html";
    const currentId = getCurrentUserId();
    const ownerId = user.id || user._id || user.authorId;
    const ownerIdStr = ownerId?.toString?.() ?? ownerId;
    if(currentId && ownerIdStr && currentId === ownerIdStr){
      return "/profile.html";
    }
    const nick = user.nick || user.username || "";
    if(nick){
      return `/profile-view.html?nick=${encodeURIComponent(nick)}`;
    }
    if(ownerIdStr){
      return `/profile-view.html?id=${encodeURIComponent(ownerIdStr)}`;
    }
    return "/profile.html";
  }

  function navigateToProfile(user){
    if(!user) return;
    const url = buildProfileUrl(user);
    closeOverlay();
    window.location.href = url;
  }

  function normalizePublication(publication, previous = null){
    if(!publication && !previous) return null;
    const base =
      typeof publication === "object" && publication
        ? publication
        : typeof previous === "object"
        ? previous
        : {};

    const owner = normalizeUser(base.owner || previous?.owner);
    const ownerId = owner?.id ?? previous?.owner?.id ?? null;
    const commentsSource = Array.isArray(base.comments)
      ? base.comments
      : Array.isArray(previous?.comments)
      ? previous.comments
      : [];
    const comments = commentsSource
      .map((comment) => normalizeComment(comment, ownerId))
      .filter(Boolean);

    const tags = Array.isArray(base.tags)
      ? base.tags
      : Array.isArray(previous?.tags)
      ? previous.tags
      : [];

    const adjustments = normalizeAdjustments({
      ...(previous?.adjustments || {}),
      ...(base.adjustments || {})
    });

    const normalized = {
      id: base.id ?? previous?.id ?? base._id?.toString?.(),
      image:
        normalizeAssetPath(base.image || previous?.image || "", "posts") ||
        "/media/iconobase.png",
      caption: base.caption ?? previous?.caption ?? "",
      tags,
      filter: typeof base.filter === "string" && base.filter.trim()
        ? base.filter.trim()
        : previous?.filter || "original",
      adjustments,
      likes:
        typeof base.likes === "number"
          ? base.likes
          : typeof previous?.likes === "number"
          ? previous.likes
          : 0,
      liked:
        typeof base.liked === "boolean"
          ? base.liked
          : typeof previous?.liked === "boolean"
          ? previous.liked
          : false,
      saved:
        typeof base.saved === "boolean"
          ? base.saved
          : typeof previous?.saved === "boolean"
          ? previous.saved
          : false,
      comments,
      commentsCount:
        typeof base.commentsCount === "number"
          ? base.commentsCount
          : typeof previous?.commentsCount === "number"
          ? previous.commentsCount
          : comments.length,
      createdAt: base.createdAt || previous?.createdAt || null,
      owner: owner || previous?.owner || null,
      isOwn:
        typeof base.isOwn === "boolean"
          ? base.isOwn
          : typeof previous?.isOwn === "boolean"
          ? previous.isOwn
          : false
    };
    return normalized;
  }

  function formatRelativeTime(value){
    if(!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(date?.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.round(diffMs / 60000);
    if(relativeTime){
      if(Math.abs(minutes) < 60){
        return relativeTime.format(-minutes, "minute");
      }
      const hours = Math.round(diffMs / 3600000);
      if(Math.abs(hours) < 24){
        return relativeTime.format(-hours, "hour");
      }
      const days = Math.round(diffMs / 86400000);
      if(Math.abs(days) < 7){
        return relativeTime.format(-days, "day");
      }
    }
    return date.toLocaleString();
  }

  function ensureOverlay(){
    if(state.overlay) return state.overlay;
    const overlay = document.createElement("div");
    overlay.className = "publication-viewer composer-backdrop";
    overlay.innerHTML = `
      <div class="publication-viewer__modal composer-modal">
        <div class="publication-viewer__media composer-preview">
          <img class="publication-viewer__image" alt="Publicación" />
        </div>
        <div class="publication-viewer__panel composer-panel">
          <header class="publication-viewer__head composer-head">
            <div class="publication-viewer__owner">
              <img class="publication-viewer__owner-avatar" alt="Autor" />
              <div class="publication-viewer__owner-meta">
                <h2 class="publication-viewer__owner-name">@usuario</h2>
                <span class="publication-viewer__owner-date"></span>
              </div>
            </div>
            <div class="publication-viewer__controls">
              <button type="button" class="publication-viewer__more" aria-label="Más opciones"><span class="icon icon-more" aria-hidden="true"></span></button>
              <button type="button" class="composer-close" aria-label="Cerrar">×</button>
            </div>
          </header>
          <p class="publication-viewer__caption"></p>
          <div class="publication-viewer__actions">
            <button type="button" class="publication-viewer__btn publication-viewer__btn--like" data-action="like">♥ Me gusta</button>
            <button type="button" class="publication-viewer__btn publication-viewer__btn--save" data-action="save">🔖 Guardar</button>
            <span class="publication-viewer__likes"></span>
          </div>
          <div class="publication-viewer__tags"></div>
          <section class="publication-viewer__comments">
            <header class="publication-viewer__comments-head">
              <h3>Comentarios</h3>
              <span class="publication-viewer__comments-count"></span>
            </header>
            <div class="publication-viewer__comments-list"></div>
            <form class="publication-viewer__form">
              <input class="publication-viewer__input" type="text" placeholder="Escribe un comentario..." autocomplete="off" />
              <button type="submit">Enviar</button>
            </form>
          </section>
        </div>
      </div>
    `;

    state.overlay = overlay;
    state.modal = overlay.querySelector(".publication-viewer__modal");
    state.refs = {
      image: overlay.querySelector(".publication-viewer__image"),
      caption: overlay.querySelector(".publication-viewer__caption"),
      likeBtn: overlay.querySelector('[data-action="like"]'),
      saveBtn: overlay.querySelector('[data-action="save"]'),
      likesLabel: overlay.querySelector(".publication-viewer__likes"),
      tags: overlay.querySelector(".publication-viewer__tags"),
      ownerContainer: overlay.querySelector(".publication-viewer__owner"),
      ownerAvatar: overlay.querySelector(".publication-viewer__owner-avatar"),
      ownerName: overlay.querySelector(".publication-viewer__owner-name"),
      ownerDate: overlay.querySelector(".publication-viewer__owner-date"),
      moreBtn: overlay.querySelector(".publication-viewer__more"),
      controlsWrap: overlay.querySelector(".publication-viewer__controls"),
      commentsList: overlay.querySelector(".publication-viewer__comments-list"),
      commentsCount: overlay.querySelector(".publication-viewer__comments-count"),
      form: overlay.querySelector(".publication-viewer__form"),
      input: overlay.querySelector(".publication-viewer__input"),
      closeBtn: overlay.querySelector(".composer-close")
    };

    // menú contextual de opciones
    const menu = document.createElement("div");
    menu.className = "publication-viewer__menu";
    menu.style.position = "absolute";
    menu.style.top = "48px";
    menu.style.right = "16px";
    menu.style.zIndex = 40;
    menu.style.display = "none";
    menu.innerHTML = `
      <button type="button" class="publication-viewer__menu-item" data-action="delete">
        <span class="icon icon-trash" aria-hidden="true"></span>
        <span>Eliminar</span>
      </button>`;
    state.refs.controlsWrap.appendChild(menu);
    state.refs.menu = menu;

    overlay.addEventListener("click", (event) => {
      if(event.target === overlay){
        closeOverlay();
      }
    });
    state.refs.closeBtn.addEventListener("click", () => closeOverlay());
    state.refs.likeBtn.addEventListener("click", () => handleLike());
    state.refs.saveBtn.addEventListener("click", () => handleSave());
    state.refs.form.addEventListener("submit", (event) => handleCommentSubmit(event));
    if(state.refs.moreBtn){
      state.refs.moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const menuEl = state.refs.menu;
        if(!menuEl) return;
        menuEl.style.display = menuEl.style.display === "none" ? "block" : "none";
      });
      // acción eliminar
      state.refs.menu?.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-action="delete"]');
        if(!btn) return;
        handleDeletePublication();
      });
      // cerrar menú al hacer click fuera
      document.addEventListener("click", (ev) => {
        const menuEl = state.refs.menu;
        if(!menuEl) return;
        if(!state.refs.controlsWrap.contains(ev.target)){
          menuEl.style.display = "none";
        }
      });
    }

    return overlay;
  }

  function applyTheme(theme){
    if(!state.overlay) return;
    const inferred =
      theme ||
      (document.body.classList.contains("theme-day")
        ? "day"
        : document.body.classList.contains("theme-night")
        ? "night"
        : window.appShell?.getTheme?.() || "night");
    state.overlay.classList.toggle("is-day", inferred === "day");
  }

  function renderTags(publication){
    if(!state.refs.tags) return;
    state.refs.tags.innerHTML = "";
    const tags = Array.isArray(publication.tags) ? publication.tags : [];
    if(!tags.length){
      const empty = document.createElement("span");
      empty.className = "publication-viewer__tag is-empty";
      empty.textContent = "#sinEtiquetas";
      state.refs.tags.appendChild(empty);
      return;
    }
    tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "publication-viewer__tag";
      chip.textContent = `#${tag}`;
      state.refs.tags.appendChild(chip);
    });
  }

  function renderComments(publication){
    if(!state.refs.commentsList) return;
    const container = state.refs.commentsList;
    container.innerHTML = "";
    const comments = Array.isArray(publication.comments) ? publication.comments : [];
    if(!comments.length){
      const empty = document.createElement("p");
      empty.className = "publication-viewer__comments-empty";
      empty.textContent = "Sé la primera persona en comentar.";
      container.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    comments.forEach((comment) => {
      if(!comment) return;
      const item = document.createElement("article");
      item.className = "publication-comment";

      const avatarWrap = document.createElement("button");
      avatarWrap.type = "button";
      avatarWrap.className = "publication-comment__avatar";
      avatarWrap.setAttribute(
        "aria-label",
        comment.author?.nick
          ? `Ver perfil de @${comment.author.nick}`
          : "Ver perfil del autor"
      );
      const avatar = document.createElement("img");
      avatar.src =
        normalizeAssetPath(comment.author?.image || "", "avatars") || "/media/iconobase.png";
      avatar.alt = comment.author?.nick ? `@${comment.author.nick}` : comment.author?.name || "Usuario";
      avatar.dataset.fallback = "avatar";
      avatarWrap.appendChild(avatar);
      attachAvatarFallback(avatar);

      const body = document.createElement("div");
      body.className = "publication-comment__body";
      const header = document.createElement("div");
      header.className = "publication-comment__header";
      const authorEl = document.createElement("button");
      authorEl.type = "button";
      authorEl.className = "publication-comment__author";
      authorEl.textContent = comment.author?.nick
        ? `@${comment.author.nick}`
        : comment.author?.name || "Usuario";
      header.appendChild(authorEl);
      if(comment.isCreator){
        const badge = document.createElement("span");
        badge.className = "publication-comment__badge";
        badge.textContent = "creador";
        header.appendChild(badge);
      }
      const timeEl = document.createElement("time");
      timeEl.className = "publication-comment__time";
      timeEl.dateTime = comment.createdAt || "";
      timeEl.textContent = formatRelativeTime(comment.createdAt);
      header.appendChild(timeEl);
      body.appendChild(header);

      const textEl = document.createElement("p");
      textEl.className = "publication-comment__text";
      textEl.textContent = comment.text || "";
      body.appendChild(textEl);

      if(comment.author){
        const navigate = (event) => {
          event.preventDefault();
          event.stopPropagation();
          navigateToProfile(comment.author);
        };
        avatarWrap.addEventListener("click", navigate);
        authorEl.addEventListener("click", navigate);
      }else{
        avatarWrap.disabled = true;
        authorEl.disabled = true;
      }

      item.appendChild(avatarWrap);
      item.appendChild(body);
      fragment.appendChild(item);
    });
    container.appendChild(fragment);
  }

  function applyPublicationToUi(){
    if(!state.publication || !state.refs) return;
    const publication = state.publication;
    const ownerDisplay = publication.owner?.nick
      ? `@${publication.owner.nick}`
      : publication.owner?.name || "Publicación";
    if(state.refs.image){
      state.refs.image.src = publication.image;
      state.refs.image.alt = publication.caption || "Publicación";
      state.refs.image.style.filter = buildFilterCss(publication);
    }
    if(state.refs.caption){
      state.refs.caption.textContent = publication.caption || "Sin descripción";
    }
    if(state.refs.likeBtn){
      state.refs.likeBtn.classList.toggle("is-active", Boolean(publication.liked));
      state.refs.likeBtn.textContent = publication.liked ? "♥ Te gusta" : "♥ Me gusta";
      state.refs.likeBtn.disabled = false;
    }
    if(state.refs.saveBtn){
      state.refs.saveBtn.classList.toggle("is-active", Boolean(publication.saved));
      state.refs.saveBtn.textContent = publication.saved ? "🔖 Guardado" : "🔖 Guardar";
      state.refs.saveBtn.disabled = false;
    }
    if(state.refs.likesLabel){
      const likes = Number(publication.likes) || 0;
      state.refs.likesLabel.textContent =
        likes === 1 ? "1 me gusta" : `${likes} me gusta`;
    }
    if(state.refs.ownerContainer){
      if(publication.owner){
        state.refs.ownerContainer.tabIndex = 0;
        state.refs.ownerContainer.classList.add("is-clickable");
        state.refs.ownerContainer.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          navigateToProfile(publication.owner);
        };
        state.refs.ownerContainer.onkeydown = (event) => {
          if(event.key === "Enter" || event.key === " "){
            event.preventDefault();
            event.stopPropagation();
            navigateToProfile(publication.owner);
          }
        };
      }else{
        state.refs.ownerContainer.classList.remove("is-clickable");
        state.refs.ownerContainer.removeAttribute("tabindex");
        state.refs.ownerContainer.onclick = null;
        state.refs.ownerContainer.onkeydown = null;
      }
    }
    if(state.refs.ownerName){
      state.refs.ownerName.textContent = ownerDisplay;
    }
    if(state.refs.ownerAvatar){
      state.refs.ownerAvatar.src =
        publication.owner?.image || "/media/iconobase.png";
      state.refs.ownerAvatar.alt = ownerDisplay;
      attachAvatarFallback(state.refs.ownerAvatar);
    }
    if(state.refs.ownerDate){
      state.refs.ownerDate.textContent = publication.createdAt
        ? new Date(publication.createdAt).toLocaleString()
        : "";
    }
    if(state.refs.commentsCount){
    // mostrar/ocultar la opción eliminar si es propia
    if(state.refs.moreBtn && state.refs.menu){
      if(publication.isOwn){
        state.refs.moreBtn.style.display = "inline-block";
        state.refs.menu.style.display = "none"; // ocultar por defecto
      }else{
        state.refs.moreBtn.style.display = "none";
        state.refs.menu.style.display = "none";
      }
    }
      const count = Number(publication.commentsCount) || 0;
      state.refs.commentsCount.textContent =
        count === 1 ? "1 comentario" : `${count} comentarios`;
    }
    if(state.refs.input){
      state.refs.input.disabled = false;
    }
    if(state.refs.form){
      state.refs.form.classList.remove("is-busy");
    }

    renderTags(publication);
    renderComments(publication);
  }

  // Diálogo de confirmación elegante (respeta tema día/noche)
  function showConfirm({
    title = "Confirmar",
    message = "",
    confirmText = "Eliminar",
    cancelText = "Cancelar",
    danger = false
  } = {}){
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "confirm-backdrop composer-backdrop";
      const theme = document.body.classList.contains("theme-day")
        ? "day"
        : document.body.classList.contains("theme-night")
        ? "night"
        : window.appShell?.getTheme?.() || "night";
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

      const onKey = (e) => {
        if(e.key === "Escape"){ cleanup(false); }
        if(e.key === "Enter"){ cleanup(true); }
      };
      const cleanup = (result) => {
        document.removeEventListener("keydown", onKey);
        backdrop.classList.remove("is-visible");
        setTimeout(() => backdrop.remove(), 180);
        resolve(result);
      };
      backdrop.addEventListener("click", (e) => {
        if(e.target === backdrop) cleanup(false);
      });
      const cancelBtn = backdrop.querySelector(".btn-cancel");
      const confirmBtn = backdrop.querySelector(".btn-confirm");
      if(cancelText){
        cancelBtn.addEventListener("click", () => cleanup(false));
      }else{
        cancelBtn.style.display = "none";
      }
      confirmBtn.addEventListener("click", () => cleanup(true));

      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add("is-visible"));
      confirmBtn.focus();
      document.addEventListener("keydown", onKey);
    });
  }

  async function handleDeletePublication(){
    if(!state.publication || !state.publication.id) return;
    const ok = await showConfirm({
      title: "Eliminar publicación",
      message: "¿Seguro que deseas eliminarla? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      danger: true
    });
    if(!ok) return;
    try{
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/publication/${encodeURIComponent(state.publication.id)}`, {
        method: "DELETE",
        headers: token ? { Authorization: token } : {}
      });
      const json = await res.json().catch(() => ({}));
      if(!res.ok){
        // Mostrar mensaje de error coherente
        showConfirm({
          title: "No se pudo eliminar",
          message: json?.message || `Error ${res.status} al eliminar la publicación`,
          confirmText: "Entendido",
          cancelText: "",
          danger: false
        }).then(()=>{});
        return;
      }
      // Emitir evento para que el feed remueva el post y cerrar
      const evt = new CustomEvent("publication:deleted", { detail: { id: state.publication.id } });
      document.dispatchEvent(evt);
      // compatibilidad si alguien escucha en window
      try{ window.dispatchEvent(evt); }catch(_e){}
      closeOverlay();
      // Recarga rápida de la página para actualizar listados
      setTimeout(() => {
        try{ window.location.reload(); }catch(_err){}
      }, 120);
    }catch(err){
      console.error(err);
      showConfirm({
        title: "Ocurrió un error",
        message: "No se pudo eliminar la publicación. Intenta de nuevo más tarde.",
        confirmText: "Cerrar"
      }).then(()=>{});
    }
  }

  function dispatchUpdate(){
    if(!state.publication) return;
    document.dispatchEvent(
      new CustomEvent("publication:updated", { detail: state.publication })
    );
  }

  function openOverlay(){
    const overlay = ensureOverlay();
    if(!overlay.parentNode){
      document.body.appendChild(overlay);
    }
    applyTheme();
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      state.isVisible = true;
    });
    document.addEventListener("keydown", handleKeydown);
  }

  function closeOverlay(){
    if(!state.overlay || !state.isVisible) return;
    state.overlay.classList.remove("is-visible");
    state.isVisible = false;
    document.removeEventListener("keydown", handleKeydown);
    setTimeout(() => {
      if(state.overlay && state.overlay.parentNode){
        state.overlay.parentNode.removeChild(state.overlay);
      }
    }, 180);
  }

  function handleKeydown(event){
    if(event.key === "Escape"){
      closeOverlay();
    }
  }

  function requireToken(){
    const token = localStorage.getItem("token");
    if(!token){
      window.location.replace?.("/index.html");
      return null;
    }
    return token;
  }

  async function handleLike(){
    if(!state.publication || !state.refs.likeBtn) return;
    const token = requireToken();
    if(!token) return;
    try{
      state.refs.likeBtn.disabled = true;
      const endpoint = `/api/publication/${state.publication.id}/likes`;
      const method = state.publication.liked ? "DELETE" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo actualizar el like");
      }
      if(data?.publication){
        state.publication = normalizePublication(data.publication, state.publication);
        applyPublicationToUi();
        dispatchUpdate();
      }
    }catch(error){
      console.warn(error);
      alert(error.message || "No se pudo actualizar el like");
      state.refs.likeBtn.disabled = false;
    }
  }

  async function handleSave(){
    if(!state.publication || !state.refs.saveBtn) return;
    const token = requireToken();
    if(!token) return;
    try{
      state.refs.saveBtn.disabled = true;
      const endpoint = `/api/publication/${state.publication.id}/save`;
      const method = state.publication.saved ? "DELETE" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo actualizar el guardado");
      }
      if(data?.publication){
        state.publication = normalizePublication(data.publication, state.publication);
        applyPublicationToUi();
        dispatchUpdate();
      }
    }catch(error){
      console.warn(error);
      alert(error.message || "No se pudo actualizar el guardado");
      state.refs.saveBtn.disabled = false;
    }
  }

  async function handleCommentSubmit(event){
    event.preventDefault();
    if(!state.publication || !state.refs.input) return;
    const token = requireToken();
    if(!token) return;
    const text = state.refs.input.value.trim();
    if(!text){
      state.refs.input.focus();
      return;
    }
    try{
      state.refs.form.classList.add("is-busy");
      state.refs.input.disabled = true;
      const res = await fetch(`/api/publication/${state.publication.id}/comments`, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo agregar el comentario");
      }
      if(data?.publication){
        state.publication = normalizePublication(data.publication, state.publication);
        applyPublicationToUi();
        dispatchUpdate();
      }
      state.refs.input.value = "";
      state.refs.input.focus();
    }catch(error){
      console.warn(error);
      alert(error.message || "No se pudo agregar el comentario");
    }finally{
      if(state.refs.form){
        state.refs.form.classList.remove("is-busy");
      }
      if(state.refs.input){
        state.refs.input.disabled = false;
      }
    }
  }

  async function fetchPublicationById(id){
    const token = requireToken();
    if(!token) return null;
    const res = await fetch(`/api/publication/${id}`, {
      headers: { Authorization: token }
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
      throw new Error(data?.message || "No se pudo cargar la publicación");
    }
    return data.publication;
  }

  function openWithPublication(publication){
    const normalized = normalizePublication(publication, state.publication);
    if(!normalized) return;
    state.publication = normalized;
    openOverlay();
    applyPublicationToUi();
  }

  async function openById(id){
    try{
      const raw = await fetchPublicationById(id);
      openWithPublication(raw);
    }catch(error){
      console.warn(error);
      alert(error.message || "No se pudo abrir la publicación");
    }
  }

  document.addEventListener("appshell:theme", (event) => {
    applyTheme(event?.detail);
  });

  window.publicationViewer = {
    openById,
    open: openWithPublication,
    close: closeOverlay,
    normalize: (publication, previous) => normalizePublication(publication, previous),
    buildFilterCss,
    normalizeAssetPath
  };
})();
