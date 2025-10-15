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
        <a class="sidebar-link js-open-composer" data-page-target="create" href="#">
          <span class="icon icon-plus" aria-hidden="true"></span>
          <span>Crear</span>
        </a>
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
    user: null
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
      sidebarLinks: Array.from(root.querySelectorAll("[data-page-target]"))
    };
    appShell.content = root.querySelector("#app-content");

    attachAvatarFallback(refs.profileAvatar);
    attachAvatarFallback(refs.sidebarAvatar);

    refs.themeToggle?.addEventListener("click", toggleTheme);
    refs.logoutBtn?.addEventListener("click", handleLogout);

    if(pageFragment && pageFragment.childNodes.length){
      appShell.content.appendChild(pageFragment);
    }

    setActiveSidebar(state.page);
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
