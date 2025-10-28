(() => {
  const THEME_KEY = "feedTheme";
  const USER_KEY = "user";
  const body = document.body;
  const root = document.getElementById("app-root");
  if(!root) return;

  const TEMPLATE = `
    <div class="app-shell__bg"></div>
    <aside class="app-shell__sidebar glass">
      <div class="sidebar-brand">
        <span class="sidebar-logo">LuminA</span>
        <span class="sidebar-sub">Moments</span>
      </div>
      <nav class="sidebar-nav">
        <a class="sidebar-link" data-page-target="feed" href="/feed.html">
          <span class="icon icon-home" aria-hidden="true"></span>
          <span>Inicio</span>
        </a>
        <a class="sidebar-link" data-page-target="explore" href="#">
          <span class="icon icon-explore" aria-hidden="true"></span>
          <span>Explorar</span>
        </a>
        <a class="sidebar-link" data-page-target="reels" href="#">
          <span class="icon icon-reels" aria-hidden="true"></span>
          <span>Reels</span>
        </a>
        <a class="sidebar-link" data-page-target="messages" href="#">
          <span class="icon icon-chat" aria-hidden="true"></span>
          <span>Mensajes</span>
          <span class="badge">2</span>
        </a>
        <div class="sidebar-create">
          <button class="sidebar-link" data-page-target="create" data-create-trigger type="button" aria-haspopup="true" aria-expanded="false">
            <span class="icon icon-plus" aria-hidden="true"></span>
            <span>Crear</span>
            <span class="sidebar-link__caret" aria-hidden="true"></span>
          </button>
          <div class="create-menu" id="app-create-menu" role="menu" aria-hidden="true">
            <button type="button" class="create-menu__item js-open-composer" data-composer-mode="publication" role="menuitem">
              <span class="create-menu__icon" aria-hidden="true">🖼️</span>
              <span>Publicación</span>
            </button>
            <button type="button" class="create-menu__item" data-composer-mode="story" role="menuitem">
              <span class="create-menu__icon" aria-hidden="true">✨</span>
              <span>Historia</span>
            </button>
          </div>
        </div>
        <a class="sidebar-link" data-page-target="profile" href="/profile.html">
          <span class="avatar-ring">
            <img id="app-sidebar-avatar" data-fallback="avatar" src="/media/iconobase.png" alt="Perfil" />
          </span>
          <span>Perfil</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <button id="app-logout-btn" class="sidebar-link logout" type="button">
          <span class="icon icon-logout" aria-hidden="true"></span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
    <div class="app-shell__main">
      <header class="app-shell__topbar glass">
        <a class="brand brand-link" href="/feed.html">
          <div class="brand-mark">LuminA</div>
          <span class="brand-sub">Moments</span>
        </a>
        <label class="search" id="app-search">
          <input id="app-search-input" type="search" placeholder="" />
          <span class="icon-search" aria-hidden="true"></span>
        </label>
        <nav class="top-actions">
          <button id="app-theme-toggle" class="toggle-theme" type="button">
            <span class="icon-sun">☀️</span>
            <span class="icon-moon">🌙</span>
            <span class="label">Modo</span>
          </button>
          <div class="notify-block">
            <button id="app-notify-toggle" class="notify-btn" type="button" aria-label="Notificaciones" aria-expanded="false">
              <span class="icon icon-bell" aria-hidden="true"></span>
              <span class="notify-count" id="app-notify-count" hidden>0</span>
            </button>
          <div class="notify-panel glass" id="app-notify-panel">
              <header class="notify-panel__head">
                <span>Notificaciones</span>
                <button id="app-notify-mark" class="notify-mark" type="button">Marcar como leídas</button>
              </header>
              <div class="notify-panel__list" id="app-notify-list">
                <p class="notify-empty">Aún no tienes notificaciones.</p>
              </div>
            </div>
          </div>
          <div class="profile-block">
            <a class="profile-chip" id="app-profile-chip" href="/profile.html">
              <img id="app-profile-avatar" data-fallback="avatar" src="/media/iconobase.png" alt="Perfil" />
              <div class="chip-meta">
                <div class="chip-name-row">
                  <span id="app-profile-name">Invitad@</span>
                  <span class="chip-name-icon" aria-hidden="true">
                    <span class="icon icon-user"></span>
                  </span>
                </div>
                <span id="app-profile-tagline">Momentos de @guest</span>
              </div>
            </a>
          </div>
        </nav>
      </header>
      <div class="app-shell__content" id="app-content"></div>
    </div>
    <button class="fab js-open-composer" type="button" title="Crear publicación">+</button>
  `;

  const state = {
    page: body.dataset.page || "feed",
    theme: "day",
    user: null,
    notifications: [],
    unread: 0,
    notificationsOpen: false
  };

  const userListeners = new Set();
  let refs = null;

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

  const relativeTime = typeof Intl !== "undefined" && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat("es", { numeric: "auto" })
    : null;

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

  function updateNotificationBadge(){
    if(!refs?.notifyCount || !refs?.notifyToggle) return;
    const unread = Number(state.unread) || 0;
    refs.notifyCount.textContent = unread.toString();
    refs.notifyCount.hidden = unread < 1;
    refs.notifyToggle.classList.toggle("has-unread", unread > 0);
  }

  function renderNotifications(){
    if(!refs?.notifyList) return;
    const list = refs.notifyList;
    list.innerHTML = "";
    const notifications = Array.isArray(state.notifications) ? state.notifications : [];
    if(!notifications.length){
      const empty = document.createElement("p");
      empty.className = "notify-empty";
      empty.textContent = "Aún no tienes notificaciones.";
      list.appendChild(empty);
      refs.notifyMark?.setAttribute("disabled", "true");
      return;
    }
    refs.notifyMark?.removeAttribute("disabled");
    const fragment = document.createDocumentFragment();
      notifications.forEach((item) => {
        if(!item) return;
        const actorName = item.actor?.nick ? `@${item.actor.nick}` : (item.actor?.name || "Alguien");
        const avatarUrl =
          normalizeAssetPath(item.actor?.image || "", "avatars") || "/media/iconobase.png";
        const ownerNick = item.publication?.owner?.nick
          ? `@${item.publication.owner.nick}`
          : "";
        const previewImage = normalizeAssetPath(item.publication?.image || "", "posts");
        const previewFilter = item.publication
          ? (window.publicationViewer?.buildFilterCss?.(item.publication) || "")
          : "";
        const entry = document.createElement("article");
        entry.className = `notify-item${item.isRead ? "" : " is-unread"}`;

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "notify-item__avatar";
      const avatarImg = document.createElement("img");
      avatarImg.src = avatarUrl;
      avatarImg.alt = actorName;
      avatarImg.dataset.fallback = "avatar";
      avatarWrap.appendChild(avatarImg);
      attachAvatarFallback(avatarImg);

      const bodyWrap = document.createElement("div");
      bodyWrap.className = "notify-item__body";
      const messageEl = document.createElement("p");
      messageEl.className = "notify-item__message";
      messageEl.textContent = item.message || "";
      bodyWrap.appendChild(messageEl);

      const meta = document.createElement("div");
      meta.className = "notify-item__meta";
      const timeEl = document.createElement("span");
      timeEl.textContent = formatRelativeTime(item.createdAt) || "";
      meta.appendChild(timeEl);
      if(ownerNick){
        const ownerEl = document.createElement("span");
        ownerEl.textContent = `· ${ownerNick}`;
        meta.appendChild(ownerEl);
      }
      bodyWrap.appendChild(meta);

      entry.appendChild(avatarWrap);
      entry.appendChild(bodyWrap);

      if(previewImage){
        const thumb = document.createElement("img");
        thumb.className = "notify-item__thumb";
        thumb.src = previewImage;
        thumb.alt = "Vista previa";
        if(previewFilter){
          thumb.style.filter = previewFilter;
        }
        entry.appendChild(thumb);
      }

      if(item.publication?.id){
        entry.addEventListener("click", () => {
          toggleNotificationsPanel(false);
          window.publicationViewer?.openById(item.publication.id);
        });
      }
      fragment.appendChild(entry);
    });
    list.appendChild(fragment);
  }

  function setNotifications(items, unread){
    state.notifications = Array.isArray(items) ? items : [];
    const computedUnread =
      typeof unread === "number"
        ? unread
        : state.notifications.filter((item) => item && !item.isRead).length;
    state.unread = computedUnread;
    renderNotifications();
    updateNotificationBadge();
  }

  async function loadNotifications(){
    const token = localStorage.getItem("token");
    if(!token) return;
    try{
      const res = await fetch("/api/user/notifications", {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudieron cargar las notificaciones");
      }
      setNotifications(data.items || [], typeof data.unread === "number" ? data.unread : undefined);
      if(state.notificationsOpen && state.unread){
        markNotificationsAsRead();
      }
    }catch(error){
      console.warn(error.message || "Error al cargar notificaciones");
    }
  }

  async function markNotificationsAsRead(ids){
    if(!state.unread) return;
    const token = localStorage.getItem("token");
    if(!token) return;
    try{
      const body =
        Array.isArray(ids) && ids.length
          ? JSON.stringify({ ids })
          : JSON.stringify({});
      const res = await fetch("/api/user/notifications/read", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json"
        },
        body
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudieron marcar como leídas");
      }
      if(Array.isArray(state.notifications)){
        state.notifications = state.notifications.map((item) =>
          item ? { ...item, isRead: true } : item
        );
      }
      state.unread = 0;
      renderNotifications();
      updateNotificationBadge();
    }catch(error){
      console.warn(error.message || "Error al marcar notificaciones");
    }
  }

  function handleNotificationsOutsideClick(event){
    if(!state.notificationsOpen) return;
    const isToggle = refs.notifyToggle?.contains(event.target);
    const isInside = refs.notifyPanel.contains(event.target);
    if(isToggle || isInside) return;
    toggleNotificationsPanel(false);
  }

  function handleCreateMenuOutside(event){
    if(!refs?.createMenu) return;
    const isTrigger = refs.createTrigger?.contains(event.target);
    const isInside = refs.createMenu.contains(event.target);
    if(isTrigger || isInside) return;
    closeCreateMenu();
  }

  function handleCreateMenuKeydown(event){
    if(event.key === "Escape"){
      closeCreateMenu();
    }
  }

  function toggleNotificationsPanel(force){
    if(!refs?.notifyPanel || !refs?.notifyToggle) return;
    const isOpen = state.notificationsOpen;
    const nextState = typeof force === "boolean" ? force : !isOpen;
    state.notificationsOpen = nextState;
    if(refs.notifyPanel){
      refs.notifyPanel.setAttribute("aria-hidden", nextState ? "false" : "true");
    }
    refs.notifyToggle.setAttribute("aria-expanded", nextState ? "true" : "false");
    refs.notifyToggle.classList.toggle("is-active", nextState);
    refs.notifyPanel.classList.toggle("is-open", nextState);
    if(nextState){
      closeCreateMenu();
      document.addEventListener("click", handleNotificationsOutsideClick, { capture: true });
      loadNotifications();
    }else{
      document.removeEventListener("click", handleNotificationsOutsideClick, { capture: true });
    }
  }

  function openCreateMenu(){
    if(!refs?.createMenu) return;
    refs.createMenu.classList.add("is-open");
    refs.createMenu.setAttribute("aria-hidden", "false");
    refs.createTrigger?.classList.add("is-open");
    refs.createTrigger?.setAttribute("aria-expanded", "true");
    document.addEventListener("click", handleCreateMenuOutside, { capture: true });
    document.addEventListener("keydown", handleCreateMenuKeydown);
  }

  function closeCreateMenu(){
    if(!refs?.createMenu) return;
    refs.createMenu.classList.remove("is-open");
    refs.createMenu.setAttribute("aria-hidden", "true");
    refs.createTrigger?.classList.remove("is-open");
    refs.createTrigger?.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", handleCreateMenuOutside, { capture: true });
    document.removeEventListener("keydown", handleCreateMenuKeydown);
  }

  function toggleCreateMenu(force){
    if(!refs?.createMenu) return;
    const isOpen = refs.createMenu.classList.contains("is-open");
    const nextState = typeof force === "boolean" ? force : !isOpen;
    if(nextState){
      toggleNotificationsPanel(false);
      openCreateMenu();
    }else{
      closeCreateMenu();
    }
  }

  function attachAvatarFallback(img){
    if(!img) return;
    const restore = () => {
      if(img.dataset.fallback === "avatar" && img.src.startsWith("data:image")) return;
      img.classList.remove("is-fallback");
    };
    img.addEventListener("load", restore, { passive: true });
    img.addEventListener("error", () => {
      img.classList.add("is-fallback");
      img.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";
    });
  }

  function setTheme(mode){
    const next = mode === "night" ? "night" : "day";
    state.theme = next;
    body.classList.toggle("theme-day", next === "day");
    body.classList.toggle("theme-night", next === "night");
    localStorage.setItem(THEME_KEY, next);
    document.dispatchEvent(new CustomEvent("appshell:theme", { detail: next }));
  }

  function toggleTheme(){
    setTheme(state.theme === "day" ? "night" : "day");
  }

  function handleLogout(){
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("token");
    window.location.replace("/index.html");
  }

  function loadStoredUser(){
    try{
      const raw = localStorage.getItem(USER_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(error){
      console.warn("No se pudo leer el usuario almacenado", error);
      return null;
    }
  }

  async function refreshUserFromApi(){
    const token = localStorage.getItem("token");
    if(!token) return null;
    try{
      const res = await fetch("/api/user/profile", {
        headers: { Authorization: token }
      });
      if(res.status === 401 || res.status === 403){
        handleLogout();
        return null;
      }
      if(!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      if(data?.user){
        appShell.setUser(data.user);
        return data.user;
      }
    }catch(error){
      console.warn("No se pudo sincronizar el perfil", error);
    }
    return null;
  }

  function updateUserUi(user){
    if(!refs) return;
    const nick = user?.nick || user?.username || user?.email?.split("@")[0] || "invitado";
    const displayName = user?.name || nick;
    const avatarUrl = normalizeAssetPath(user?.avatar || user?.image || user?.photo, "avatars") || "/media/iconobase.png";

    if(refs.profileName){
      refs.profileName.textContent = displayName;
    }
    if(refs.profileTagline){
      refs.profileTagline.textContent = `Momentos de @${nick}`;
    }
    if(refs.profileAvatar){
      refs.profileAvatar.src = avatarUrl;
      refs.profileAvatar.alt = displayName;
    }
    if(refs.sidebarAvatar){
      refs.sidebarAvatar.src = avatarUrl;
      refs.sidebarAvatar.alt = displayName;
    }
  }

  function setActiveSidebar(page){
    state.page = page;
    if(!refs) return;
    closeCreateMenu();
    refs.sidebarLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.pageTarget === page);
    });
  }

  function ensureSession(){
    const token = localStorage.getItem("token");
    if(!token){
      handleLogout();
      return false;
    }
    const storedUser = loadStoredUser();
    if(storedUser){
      appShell.setUser(storedUser, { persist: false });
    }
    return true;
  }

  function emitReady(){
    const event = new CustomEvent("appshell:ready", { detail: appShell });
    document.dispatchEvent(event);
  }

  function buildShell(pageFragment){
    root.innerHTML = TEMPLATE;
    refs = {
      searchWrapper: root.querySelector("#app-search"),
      searchInput: root.querySelector("#app-search-input"),
      themeToggle: root.querySelector("#app-theme-toggle"),
      profileAvatar: root.querySelector("#app-profile-avatar"),
      profileName: root.querySelector("#app-profile-name"),
      profileTagline: root.querySelector("#app-profile-tagline"),
      sidebarAvatar: root.querySelector("#app-sidebar-avatar"),
      logoutBtn: root.querySelector("#app-logout-btn"),
      fab: root.querySelector(".fab"),
      sidebarLinks: Array.from(root.querySelectorAll("[data-page-target]")),
      notifyToggle: root.querySelector("#app-notify-toggle"),
      notifyPanel: root.querySelector("#app-notify-panel"),
      notifyList: root.querySelector("#app-notify-list"),
      notifyCount: root.querySelector("#app-notify-count"),
      notifyMark: root.querySelector("#app-notify-mark"),
      createTrigger: root.querySelector("[data-create-trigger]"),
      createMenu: root.querySelector("#app-create-menu"),
      createItems: Array.from(root.querySelectorAll(".create-menu__item"))
    };
    appShell.content = root.querySelector("#app-content");

    attachAvatarFallback(refs.profileAvatar);
    attachAvatarFallback(refs.sidebarAvatar);

    if(refs.notifyPanel){
      refs.notifyPanel.classList.remove("is-open");
      refs.notifyPanel.setAttribute("aria-hidden", "true");
    }

    refs.themeToggle?.addEventListener("click", toggleTheme);
    refs.logoutBtn?.addEventListener("click", handleLogout);
    refs.notifyToggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleNotificationsPanel();
    });
    refs.notifyMark?.addEventListener("click", (event) => {
      event.stopPropagation();
      markNotificationsAsRead();
    });
    refs.createTrigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCreateMenu();
    });
    refs.createItems?.forEach((item) => {
      item.addEventListener("click", () => {
        closeCreateMenu();
      });
    });

    if(pageFragment && pageFragment.childNodes.length){
      appShell.content.appendChild(pageFragment);
    }

    closeCreateMenu();
    setActiveSidebar(state.page);
    renderNotifications();
    updateNotificationBadge();
  }

  function collectPageContent(){
    const container = document.getElementById("page-content");
    if(!container) return null;
    const fragment = document.createDocumentFragment();
    while(container.firstChild){
      fragment.appendChild(container.firstChild);
    }
    container.remove();
    return fragment;
  }

  function init(){
    const pageFragment = collectPageContent();
    buildShell(pageFragment);

    const storedTheme = localStorage.getItem(THEME_KEY);
    setTheme(storedTheme === "night" ? "night" : "day");

    document
      .querySelectorAll('img[data-fallback="avatar"]')
      .forEach(attachAvatarFallback);

    if(!ensureSession()){
      return;
    }

    refreshUserFromApi();
    loadNotifications();
    appShell.isReady = true;
    emitReady();
  }

  const appShell = {
    isReady: false,
    state,
    refs,
    content: null,
    setSearchPlaceholder(placeholder){
      if(!refs?.searchInput) return;
      refs.searchInput.placeholder = placeholder || "";
    },
    setSearchVisibility(visible){
      if(!refs?.searchWrapper) return;
      refs.searchWrapper.classList.toggle("is-hidden", visible === false);
    },
    setFabVisible(visible){
      if(!refs?.fab) return;
      refs.fab.classList.toggle("is-hidden", visible === false);
    },
    setActiveSidebar,
    getTheme(){
      return state.theme;
    },
    getNotifications(){
      return Array.isArray(state.notifications) ? [...state.notifications] : [];
    },
    refreshNotifications: loadNotifications,
    markNotificationsAsRead(ids){
      markNotificationsAsRead(ids);
    },
    onUser(fn){
      if(typeof fn === "function"){
        userListeners.add(fn);
        if(state.user) fn(state.user);
      }
    },
    offUser(fn){
      if(fn) userListeners.delete(fn);
    },
    setUser(user, { persist = true } = {}){
      state.user = user || null;
      if(persist && user){
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
       if(user && typeof user.notificationsUnread === "number"){
        state.unread = user.notificationsUnread;
        updateNotificationBadge();
      }else if(!user){
        state.unread = 0;
        state.notifications = [];
        renderNotifications();
        updateNotificationBadge();
      }
      updateUserUi(user);
      userListeners.forEach((listener) => {
        try{
          listener(user);
        }catch(error){
          console.warn("appShell user listener error", error);
        }
      });
    },
    getUser(){
      return state.user;
    },
    loadStoredUser,
    refreshUserFromApi,
    attachAvatarFallback
  };

  window.appShell = appShell;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
