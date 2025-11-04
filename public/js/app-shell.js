(() => {
  const THEME_KEY = "feedTheme";
  const USER_KEY = "user";
  const body = document.body;
  const root = document.getElementById("app-root");
  if(!root) return;
  let socket = null;
  let socketScriptPromise = null;

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
        <a class="sidebar-link" data-page-target="messages" href="/messages.html">
          <span class="icon icon-chat" aria-hidden="true"></span>
          <span>Mensajes</span>
          <span class="badge" id="app-messages-badge" hidden>0</span>
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
          <input id="app-search-input" type="search" placeholder="" autocomplete="off" />
          <span class="icon-search" aria-hidden="true"></span>
          <div class="search-suggestions" id="app-search-suggestions" hidden>
            <div class="search-suggestions__list" id="app-search-suggestions-list"></div>
          </div>
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
    notificationsOpen: false,
    messagesUnread: 0
  };

  const userListeners = new Set();
  let refs = null;
  const searchState = {
    query: "",
    suggestions: [],
    highlightedIndex: -1,
    open: false,
    loading: false,
    timer: null,
    message: "",
    abortController: null,
    lastFetched: ""
  };

  function escapeHtml(value){
    if(value === null || value === undefined) return "";
    return value
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function closeSearchSuggestions({ reset = true } = {}){
    searchState.open = false;
    searchState.loading = false;
    searchState.message = "";
    if(reset){
      searchState.highlightedIndex = -1;
      searchState.suggestions = [];
    }
    if(searchState.abortController){
      try{ searchState.abortController.abort(); }catch(_err){}
      searchState.abortController = null;
    }
    if(refs?.searchSuggestions){
      refs.searchSuggestions.hidden = true;
    }
  }

  function ensureHighlightedVisible(){
    if(!refs?.searchSuggestionsList) return;
    const index = searchState.highlightedIndex;
    if(index < 0) return;
    const node = refs.searchSuggestionsList.querySelector(`[data-index="${index}"]`);
    if(!node) return;
    const parent = refs.searchSuggestionsList;
    const top = node.offsetTop;
    const bottom = top + node.offsetHeight;
    if(top < parent.scrollTop){
      parent.scrollTop = top;
    }else if(bottom > parent.scrollTop + parent.clientHeight){
      parent.scrollTop = bottom - parent.clientHeight;
    }
  }

  function renderSearchSuggestions(){
    if(!refs?.searchSuggestions || !refs?.searchSuggestionsList) return;
    if(!searchState.open){
      refs.searchSuggestions.hidden = true;
      refs.searchSuggestionsList.innerHTML = "";
      return;
    }
    let innerHtml = "";
    if(searchState.loading){
      innerHtml = '<div class="search-suggestions__empty">Buscando...</div>';
    }else if(searchState.message){
      innerHtml = `<div class="search-suggestions__empty">${escapeHtml(searchState.message)}</div>`;
    }else if(!searchState.suggestions.length){
      innerHtml = '<div class="search-suggestions__empty">No se encontraron coincidencias</div>';
    }else{
      innerHtml = searchState.suggestions
        .map((user, index) => {
          const active = index === searchState.highlightedIndex ? " is-active" : "";
          const avatar = escapeHtml(user.image || "/media/iconobase.png");
          const name = escapeHtml(user.name || user.nick || "Usuario");
          const nick = user.nick ? `@${escapeHtml(user.nick)}` : "";
          const bio = user.bio ? escapeHtml(user.bio) : "";
          const subtitle = nick && bio ? `${nick} · ${bio}` : nick || bio;
          return `<button type="button" class="search-suggestions__item${active}" data-index="${index}" data-id="${escapeHtml(user.id || "")}" data-nick="${escapeHtml(user.nick || "")}">
              <img class="search-suggestions__avatar" src="${avatar}" alt="${name}" />
              <div class="search-suggestions__meta">
                <span class="search-suggestions__name">${name}</span>
                <span class="search-suggestions__nick">${subtitle}</span>
              </div>
            </button>`;
        })
        .join("");
    }
    refs.searchSuggestionsList.innerHTML = innerHtml;
    refs.searchSuggestions.hidden = false;
    ensureHighlightedVisible();
  }

  function setHighlightedSuggestion(index){
    if(!searchState.suggestions.length){
      searchState.highlightedIndex = -1;
      renderSearchSuggestions();
      return;
    }
    let nextIndex = index;
    if(nextIndex < 0){
      nextIndex = searchState.suggestions.length - 1;
    }else if(nextIndex >= searchState.suggestions.length){
      nextIndex = 0;
    }
    searchState.highlightedIndex = nextIndex;
    renderSearchSuggestions();
  }

  async function fetchSearchSuggestions(query){
    try{
      if(searchState.abortController){
        searchState.abortController.abort();
      }
      const token = localStorage.getItem("token");
      if(!token){
        searchState.loading = false;
        searchState.suggestions = [];
        searchState.message = "";
        renderSearchSuggestions();
        return;
      }
      const controller = new AbortController();
      searchState.abortController = controller;
      const res = await fetch(`/api/search/users?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: token },
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.error || data?.message || `Error ${res.status}`);
      }
      const suggestions = Array.isArray(data?.users) ? data.users : [];
      searchState.suggestions = suggestions;
      searchState.loading = false;
      searchState.message = suggestions.length ? "" : "No se encontraron coincidencias";
      searchState.open = true;
      searchState.highlightedIndex = -1;
      searchState.lastFetched = query;
      renderSearchSuggestions();
      searchState.abortController = null;
    }catch(error){
      if(error.name === "AbortError") return;
      console.warn("No se pudieron obtener sugerencias", error);
      searchState.loading = false;
      searchState.suggestions = [];
      searchState.message = "No se pudieron obtener sugerencias";
      searchState.open = true;
      renderSearchSuggestions();
      searchState.abortController = null;
    }
  }

  function handleSuggestionSelection(user){
    if(!user) return;
    closeSearchSuggestions();
    const nick = user.nick ? user.nick.trim() : "";
    const id = user.id ? user.id.toString() : "";
    if(nick){
      window.location.href = `/profile-view.html?nick=${encodeURIComponent(nick)}`;
      return;
    }
    if(id){
      window.location.href = `/profile-view.html?id=${encodeURIComponent(id)}`;
      return;
    }
  }

  function submitSearch(query){
    const trimmed = (query || "").trim();
    if(!trimmed){
      closeSearchSuggestions();
      if(state.page === "feed"){
        document.dispatchEvent(new CustomEvent("search:submitted", { detail: { query: "" } }));
      }
      return;
    }
    closeSearchSuggestions();
    if(state.page === "feed"){
      document.dispatchEvent(new CustomEvent("search:submitted", { detail: { query: trimmed } }));
    }else{
      window.location.href = `/feed.html?q=${encodeURIComponent(trimmed)}`;
    }
  }

  function handleSearchInput(event){
    const value = event.target.value || "";
    searchState.query = value;
    if(searchState.timer){
      clearTimeout(searchState.timer);
      searchState.timer = null;
    }
    const trimmed = value.trim();
    if(!trimmed){
      searchState.suggestions = [];
      searchState.message = "";
      searchState.loading = false;
      closeSearchSuggestions();
      return;
    }
    if(trimmed === searchState.lastFetched && searchState.suggestions.length){
      searchState.loading = false;
      searchState.open = true;
      searchState.message = "";
      renderSearchSuggestions();
      return;
    }
    searchState.loading = true;
    searchState.open = true;
    searchState.message = "";
    renderSearchSuggestions();
    searchState.timer = setTimeout(() => {
      fetchSearchSuggestions(trimmed);
      searchState.timer = null;
    }, 220);
  }

  function handleSearchFocus(){
    if(!refs?.searchInput) return;
    if(searchState.suggestions.length){
      searchState.open = true;
      renderSearchSuggestions();
    }else if(searchState.query.trim()){
      const trimmed = searchState.query.trim();
      if(trimmed === searchState.lastFetched && searchState.suggestions.length){
        searchState.loading = false;
        searchState.open = true;
        renderSearchSuggestions();
        return;
      }
      searchState.loading = true;
      searchState.open = true;
      renderSearchSuggestions();
      fetchSearchSuggestions(trimmed);
    }
  }

  function handleSearchKeydown(event){
    if(event.key === "ArrowDown"){
      if(!searchState.open){
        searchState.open = true;
        renderSearchSuggestions();
      }
      setHighlightedSuggestion(searchState.highlightedIndex + 1);
      event.preventDefault();
      return;
    }
    if(event.key === "ArrowUp"){
      if(!searchState.open){
        searchState.open = true;
        renderSearchSuggestions();
      }
      setHighlightedSuggestion(searchState.highlightedIndex - 1);
      event.preventDefault();
      return;
    }
    if(event.key === "Enter"){
      event.preventDefault();
      if(searchState.open && searchState.highlightedIndex >= 0){
        const suggestion = searchState.suggestions[searchState.highlightedIndex];
        if(suggestion){
          handleSuggestionSelection(suggestion);
          return;
        }
      }
      submitSearch(searchState.query);
      return;
    }
    if(event.key === "Escape"){
      closeSearchSuggestions();
    }
  }

  function handleSuggestionClick(event){
    const target = event.target.closest("[data-index]");
    if(!target) return;
    const index = Number.parseInt(target.dataset.index, 10);
    if(Number.isNaN(index)) return;
    const suggestion = searchState.suggestions[index];
    handleSuggestionSelection(suggestion);
  }

  function handleSearchBlur(){
    setTimeout(() => {
      if(!document.activeElement || !refs?.searchSuggestions?.contains(document.activeElement)){
        closeSearchSuggestions();
      }
    }, 120);
  }

  function handleDocumentClick(event){
    if(!refs?.searchWrapper) return;
    if(refs.searchWrapper.contains(event.target)) return;
    closeSearchSuggestions();
  }

  function initSearchControls(){
    if(!refs?.searchInput) return;
    refs.searchInput.addEventListener("input", handleSearchInput);
    refs.searchInput.addEventListener("focus", handleSearchFocus);
    refs.searchInput.addEventListener("keydown", handleSearchKeydown);
    refs.searchInput.addEventListener("blur", handleSearchBlur);
    refs.searchSuggestions?.addEventListener("mousedown", (event) => event.preventDefault());
    refs.searchSuggestions?.addEventListener("click", handleSuggestionClick);
    document.addEventListener("click", handleDocumentClick);
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

  function updateMessagesBadge(){
    if(!refs?.messagesBadge) return;
    const unread = Number(state.messagesUnread) || 0;
    refs.messagesBadge.textContent = unread.toString();
    refs.messagesBadge.hidden = unread < 1;
    if(refs.messagesLink){
      refs.messagesLink.classList.toggle("has-unread", unread > 0);
    }
  }

  function setMessagesUnread(unread, { notify = true, persist = true } = {}){
    const valueRaw = Number.parseInt(unread, 10);
    const value = Number.isFinite(valueRaw) && valueRaw > 0 ? valueRaw : 0;
    state.messagesUnread = value;
    updateMessagesBadge();
    if(state.user){
      const nextUser = { ...state.user, messagesUnread: value };
      state.user = nextUser;
      if(persist){
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      }
      if(notify){
        userListeners.forEach((listener) => {
          try{
            listener(nextUser);
          }catch(error){
            console.warn("appShell user listener error", error);
          }
        });
      }
    }else if(persist){
      const stored = localStorage.getItem(USER_KEY);
      if(stored){
        try{
          const parsed = JSON.parse(stored);
          parsed.messagesUnread = value;
          localStorage.setItem(USER_KEY, JSON.stringify(parsed));
        }catch(error){
          console.warn("No se pudo actualizar el usuario almacenado", error);
        }
      }
    }
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
      const type = item.type || "generic";
      const actorName = item.actor?.nick
        ? `@${item.actor.nick}`
        : item.actor?.name || "Alguien";
      const avatarUrl =
        normalizeAssetPath(item.actor?.image || "", "avatars") || "/media/iconobase.png";
      const entry = document.createElement("article");
      entry.className = `notify-item${item.isRead ? "" : " is-unread"}`;
      entry.dataset.type = type;

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "notify-item__avatar";
      const avatarImg = document.createElement("img");
      avatarImg.src = avatarUrl;
      avatarImg.alt = actorName;
      avatarImg.dataset.fallback = "avatar";
      avatarWrap.appendChild(avatarImg);
      attachAvatarFallback(avatarImg);
      entry.appendChild(avatarWrap);

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
      if(type === "message"){
        const tag = document.createElement("span");
        tag.textContent = "· Mensaje";
        meta.appendChild(tag);
      }else if(item.publication?.owner?.nick){
        const ownerEl = document.createElement("span");
        ownerEl.textContent = `· @${item.publication.owner.nick}`;
        meta.appendChild(ownerEl);
      }
      bodyWrap.appendChild(meta);
      entry.appendChild(bodyWrap);

      if(type !== "message"){
        const previewImage = normalizeAssetPath(item.publication?.image || "", "posts");
        if(previewImage){
          const thumb = document.createElement("img");
          thumb.className = "notify-item__thumb";
          thumb.src = previewImage;
          thumb.alt = "Vista previa";
          const previewFilter =
            item.publication
              ? window.publicationViewer?.buildFilterCss?.(item.publication) || ""
              : "";
          if(previewFilter){
            thumb.style.filter = previewFilter;
          }
          entry.appendChild(thumb);
        }
      }

      if(type === "message"){
        entry.addEventListener("click", () => {
          toggleNotificationsPanel(false);
          let target = "/messages.html";
          if(item.conversation?.id){
            target += `?conversation=${encodeURIComponent(item.conversation.id)}`;
          }else if(item.actor?.id){
            target += `?user=${encodeURIComponent(item.actor.id)}`;
          }
          window.location.href = target;
        });
      }else if(item.publication?.id){
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

  async function loadMessagesSummary(){
    const token = localStorage.getItem("token");
    if(!token) return;
    try{
      const res = await fetch("/api/messages/summary", {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo obtener el resumen de mensajes");
      }
      const unread = Number(data?.totalUnread);
      setMessagesUnread(Number.isFinite(unread) ? unread : 0, { notify: false });
    }catch(error){
      console.warn(error.message || "Error al cargar el resumen de mensajes");
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
    disconnectSocket();
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
      searchSuggestions: root.querySelector("#app-search-suggestions"),
      searchSuggestionsList: root.querySelector("#app-search-suggestions-list"),
      themeToggle: root.querySelector("#app-theme-toggle"),
      profileAvatar: root.querySelector("#app-profile-avatar"),
      profileName: root.querySelector("#app-profile-name"),
      profileTagline: root.querySelector("#app-profile-tagline"),
      sidebarAvatar: root.querySelector("#app-sidebar-avatar"),
      logoutBtn: root.querySelector("#app-logout-btn"),
      fab: root.querySelector(".fab"),
      sidebarLinks: Array.from(root.querySelectorAll("[data-page-target]")),
      messagesLink: root.querySelector('[data-page-target="messages"]'),
      messagesBadge: root.querySelector("#app-messages-badge"),
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

    initSearchControls();

    if(pageFragment && pageFragment.fragment && pageFragment.fragment.childNodes.length){
      const surface = document.createElement("div");
      const meta = pageFragment.meta || {};
      const originalClass =
        typeof meta.className === "string" ? meta.className.trim() : "";
      surface.className = originalClass ? `${originalClass} page-surface` : "page-surface";
      if(meta.id){
        surface.id = meta.id;
      }
      if(meta.dataset){
        Object.entries(meta.dataset).forEach(([key, value]) => {
          if(typeof value === "string"){
            surface.dataset[key] = value;
          }
        });
      }
      if(Array.isArray(meta.attributes)){
        meta.attributes.forEach((attr) => {
          if(
            !attr ||
            !attr.name ||
            attr.name === "id" ||
            attr.name === "class" ||
            attr.name === "hidden"
          ){
            return;
          }
          surface.setAttribute(attr.name, attr.value ?? "");
        });
      }
      appShell.content.appendChild(surface);
      surface.appendChild(pageFragment.fragment);
      appShell.pageSurface = surface;
      requestAnimationFrame(() => {
        surface.classList.add("is-mounted");
      });
    }else if(pageFragment && pageFragment.fragment){
      appShell.content.appendChild(pageFragment.fragment);
      appShell.pageSurface = null;
    }

    closeCreateMenu();
    setActiveSidebar(state.page);
    renderNotifications();
    updateNotificationBadge();
    updateMessagesBadge();
  }

  function collectPageContent(){
    const container = document.getElementById("page-content");
    if(!container) return null;
    const fragment = document.createDocumentFragment();
    while(container.firstChild){
      fragment.appendChild(container.firstChild);
    }
    const meta = {
      id: container.id || "",
      className: container.className || "",
      dataset: { ...container.dataset },
      attributes: Array.from(container.attributes || []).map((attr) => ({
        name: attr.name,
        value: attr.value
      }))
    };
    container.remove();
    return { fragment, meta };
  }

  function loadSocketClient(){
    if(typeof window === "undefined"){
      return Promise.reject(new Error("window unavailable"));
    }
    if(typeof window.io === "function"){
      return Promise.resolve(window.io);
    }
    if(socketScriptPromise){
      return socketScriptPromise;
    }
    socketScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/socket.io/socket.io.js";
      script.async = true;
      script.onload = () => resolve(window.io);
      script.onerror = (error) => {
        socketScriptPromise = null;
        reject(error);
      };
      document.head.appendChild(script);
    });
    return socketScriptPromise;
  }

  function handleSocketMessageUpdate(payload){
    if(!payload || typeof payload !== "object") return;
    if(typeof payload.totalUnread === "number"){
      setMessagesUnread(payload.totalUnread, { notify: true, persist: true });
    }
    document.dispatchEvent(new CustomEvent("messages:socket", { detail: payload }));
  }

  async function connectSocket(){
    if(socket || !state.user){
      return;
    }
    const token = localStorage.getItem("token");
    if(!token){
      return;
    }
    try{
      const ioClient = await loadSocketClient();
      if(typeof ioClient !== "function"){
        return;
      }
      socket = ioClient("/", {
        auth: { token },
        withCredentials: true,
        transports: ["websocket", "polling"]
      });
      socket.on("messages:update", handleSocketMessageUpdate);
      socket.on("connect_error", (error) => {
        console.warn("Socket error:", error?.message || error);
      });
    }catch(error){
      console.warn("No se pudo iniciar la conexión en vivo", error?.message || error);
    }
  }

  function disconnectSocket(){
    if(!socket) return;
    try{
      socket.off("messages:update", handleSocketMessageUpdate);
      socket.disconnect();
    }catch(error){
      console.warn("No se pudo cerrar la conexión en vivo", error?.message || error);
    }
    socket = null;
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
    loadMessagesSummary();
    appShell.isReady = true;
    emitReady();
  }

  const appShell = {
    isReady: false,
    state,
    refs,
    content: null,
    pageSurface: null,
    setSearchPlaceholder(placeholder){
      if(!refs?.searchInput) return;
      refs.searchInput.placeholder = placeholder || "";
    },
    setSearchValue(value){
      if(refs?.searchInput){
        refs.searchInput.value = value || "";
      }
      searchState.query = value || "";
      if(!value){
        searchState.suggestions = [];
        searchState.message = "";
        closeSearchSuggestions();
      }
    },
    hideSearchSuggestions(){
      closeSearchSuggestions();
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
    getMessagesUnread(){
      return state.messagesUnread;
    },
    setMessagesUnread(count, options){
      setMessagesUnread(count, options);
    },
    refreshMessagesSummary: loadMessagesSummary,
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
      if(!user){
        disconnectSocket();
        state.user = null;
        if(persist){
          localStorage.removeItem(USER_KEY);
        }
        state.unread = 0;
        state.notifications = [];
        renderNotifications();
        updateNotificationBadge();
        state.messagesUnread = 0;
        updateMessagesBadge();
        updateUserUi(null);
        userListeners.forEach((listener) => {
          try{
            listener(null);
          }catch(error){
            console.warn("appShell user listener error", error);
          }
        });
        return;
      }
      const normalized = { ...user };
      const notificationsUnread =
        typeof normalized.notificationsUnread === "number"
          ? normalized.notificationsUnread
          : state.unread;
      state.unread = Number.isFinite(notificationsUnread) ? notificationsUnread : 0;
      updateNotificationBadge();

      const messagesUnreadRaw =
        typeof normalized.messagesUnread === "number"
          ? normalized.messagesUnread
          : state.messagesUnread;
      const messagesUnread = Number.isFinite(messagesUnreadRaw)
        ? Math.max(0, Math.trunc(messagesUnreadRaw))
        : 0;
      normalized.messagesUnread = messagesUnread;
      state.messagesUnread = messagesUnread;
      updateMessagesBadge();

      state.user = normalized;
      if(persist){
        localStorage.setItem(USER_KEY, JSON.stringify(normalized));
      }
      connectSocket();
      updateUserUi(normalized);
      userListeners.forEach((listener) => {
        try{
          listener(normalized);
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
