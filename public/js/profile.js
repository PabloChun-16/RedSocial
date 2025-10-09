const body = document.body;
const themeToggle = document.getElementById("profile-theme-toggle");
const chipAvatar = document.getElementById("profile-chip-avatar");
const chipName = document.getElementById("profile-chip-name");
const chipNick = document.getElementById("profile-chip-nick");
const heroAvatar = document.getElementById("profile-hero-avatar");
const heroEditBtn = document.getElementById("hero-edit-btn");
const profileUsername = document.getElementById("profile-username");
const profileFullname = document.getElementById("profile-fullname");
const profileTagline = document.getElementById("profile-tagline");
const profileRole = document.getElementById("profile-role");
const profileBio = document.getElementById("profile-bio");
const postsCountEl = document.getElementById("profile-posts-count");
const followersCountEl = document.getElementById("profile-followers-count");
const followingCountEl = document.getElementById("profile-following-count");
const highlightRail = document.getElementById("highlight-rail");
const tabs = Array.from(document.querySelectorAll(".tab"));
const galleryTitle = document.getElementById("gallery-title");
const gallery = document.getElementById("profile-grid");
const galleryEmpty = document.getElementById("profile-empty");
const galleryEmptyCta = galleryEmpty?.querySelector("button") ?? null;
const newPostBtn = document.getElementById("new-post-btn");

const AVATAR_FALLBACK =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";
const AVATAR_DEFAULT = "/media/iconobase.png";
const THEME_KEY = "feedTheme";
const USER_KEY = "user";

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

function attachAvatarFallback(img){
  if(!img) return;
  const fallbackAttr = img.dataset.fallback;
  if(fallbackAttr !== "avatar") return;
  const restore = () => {
    if(img.src === AVATAR_FALLBACK) return;
    img.classList.remove("is-fallback");
  };
  img.addEventListener("load", restore, { passive: true });
  img.addEventListener("error", () => {
    img.classList.add("is-fallback");
    img.src = AVATAR_FALLBACK;
  });
}

function setTheme(mode){
  body.classList.toggle("theme-day", mode === "day");
  body.classList.toggle("theme-night", mode === "night");
  localStorage.setItem(THEME_KEY, mode);
}

function toggleTheme(){
  const current = body.classList.contains("theme-day") ? "day" : "night";
  setTheme(current === "day" ? "night" : "day");
}

function loadStoredUser(){
  try{
    const raw = localStorage.getItem(USER_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(err){
    console.warn("No se pudo leer el usuario almacenado", err);
    return null;
  }
}

async function fetchProfileFromApi(token){
  try{
    const res = await fetch("/api/user/profile", {
      headers: { Authorization: token }
    });
    if(res.status === 401 || res.status === 403){
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem("token");
      window.location.replace("/index.html");
      return null;
    }
    if(!res.ok) return null;
    const data = await res.json();
    if(data?.user){
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
  }catch(err){
    console.warn("No se pudo sincronizar el perfil", err);
  }
  return null;
}

function normalizeAvatar(value){
  if(!value) return null;
  const trimmed = value.trim();
  if(!trimmed) return null;
  if(trimmed === "default.png") return AVATAR_DEFAULT;
  if(/^https?:\/\//i.test(trimmed)) return trimmed;
  if(trimmed.startsWith("/")) return trimmed;
  if(trimmed.startsWith("./")) return normalizeAvatar(trimmed.slice(2));
  if(trimmed.startsWith("media/") || trimmed.startsWith("uploads/")) return `/${trimmed}`;
  return `/media/${trimmed}`;
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
  const nick = user?.nick || user?.username || user?.email?.split("@")[0] || "usuario";
  const fullName = user?.name ? `${user.name}${user.surname ? ` ${user.surname}` : ""}` : nick;
  const avatarUrl = normalizeAvatar(user?.avatar || user?.image || user?.photo);

  if(profileUsername) profileUsername.textContent = `@${nick}`;
  if(profileFullname) profileFullname.textContent = fullName;
  if(profileTagline) profileTagline.textContent = `Momentos de @${nick}`;
  if(profileRole) profileRole.textContent = user?.role ? user.role.replace(/_/g, " ") : "Miembro LuminA";
  if(profileBio) profileBio.textContent = user?.bio || "Personaliza tu historia: comparte momentos, colecciona recuerdos y mantente cerca de tu círculo creativo.";

  const stats = {
    posts: user?.stats?.posts ?? state.collections.posts.length,
    followers: user?.stats?.followers ?? user?.followers ?? 0,
    following: user?.stats?.following ?? user?.following ?? 0
  };
  if(postsCountEl) postsCountEl.textContent = stats.posts.toString();
  if(followersCountEl) followersCountEl.textContent = formatNumber(stats.followers);
  if(followingCountEl) followingCountEl.textContent = formatNumber(stats.following);

  [chipAvatar, heroAvatar].forEach((img) => {
    if(!img) return;
    if(avatarUrl){
      img.src = avatarUrl;
      img.classList.remove("is-fallback");
    }else{
      img.src = AVATAR_DEFAULT;
      img.classList.add("is-fallback");
    }
  });

  if(chipName) chipName.textContent = fullName.split(" ")[0] || nick;
  if(chipNick) chipNick.textContent = `@${nick}`;
}

function renderHighlights(){
  if(!highlightRail) return;
  highlightRail.innerHTML = "";
  HIGHLIGHTS.forEach((item) => {
    const card = document.createElement("article");
    card.className = "highlight-card";
    card.innerHTML = `
      <div class="highlight-thumb">
        <img src="${item.image}" alt="${item.title}" loading="lazy">
      </div>
      <span class="highlight-title">${item.title}</span>
      <span class="highlight-meta">${item.meta}</span>
    `;
    highlightRail.appendChild(card);
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
  if(!gallery || !galleryTitle || !galleryEmpty) return;
  const key = tab || state.currentTab;
  state.currentTab = key;
  const dataset = state.collections[key] ?? [];
  galleryTitle.textContent =
    key === "posts" ? "Publicaciones" : key === "saved" ? "Guardados" : "Etiquetas";

  gallery.innerHTML = "";
  if(dataset.length === 0){
    gallery.hidden = true;
    galleryEmpty.hidden = false;
    return;
  }

  gallery.hidden = false;
  galleryEmpty.hidden = true;

  dataset.forEach((item) => {
    const card = document.createElement("article");
    card.className = "profile-card";
    card.dataset.id = item.id;
    card.innerHTML = `
      <img src="${item.image}" alt="${item.caption || "Publicación"}" loading="lazy" />
      <div class="profile-card__overlay">
        <div class="profile-card__meta">
          <span>♥ ${formatNumber(item.likes || 0)}</span>
          <span>🏷 ${item.tags?.length || 0}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openPublicationModal(item.id));
    gallery.appendChild(card);
  });
}

function initTabs(){
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;
      if(!key) return;
      tabs.forEach((btn) => btn.classList.toggle("is-active", btn === tab));
      renderGallery(key);
    });
  });
  renderGallery(state.currentTab);
}

function initHighlights(){
  renderHighlights();
}

function wireEvents(){
  themeToggle?.addEventListener("click", toggleTheme);
  heroEditBtn?.addEventListener("click", () => {
    window.location.href = "/profile-edit.html";
  });
  newPostBtn?.addEventListener("click", () => {
    window.postComposer?.open();
  });
  galleryEmptyCta?.addEventListener("click", () => {
    window.postComposer?.open();
  });
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
    state.collections.posts = Array.isArray(data.items) ? data.items : [];
    state.collections.saved = [];
    state.collections.tagged = [];
    if(postsCountEl) postsCountEl.textContent = state.collections.posts.length.toString();
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
  const overlay = document.createElement("div");
  overlay.className = "composer-backdrop is-visible";
  overlay.innerHTML = `
    <div class="composer-modal" style="max-width:900px;">
      <div class="composer-preview" style="background:rgba(0,0,0,.6);">
        <img src="${publication.image}" alt="${publication.caption || "Publicación"}" style="filter:${buildFilterCss(publication)}" />
      </div>
      <div class="composer-panel" style="padding:26px;">
        <header class="composer-head">
          <h2>${publication.owner?.nick ? `@${publication.owner.nick}` : "Publicación"}</h2>
          <button type="button" class="composer-close">×</button>
        </header>
        <p>${publication.caption || "Sin descripción"}</p>
        <div class="hero-meta">
          <span>${new Date(publication.createdAt).toLocaleString()}</span>
          <span>${publication.tags?.length || 0} etiquetas</span>
        </div>
        <div class="composer-tags">
          ${
            publication.tags?.length
              ? publication.tags.map((tag) => `<span>#${tag}</span>`).join(" ")
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

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if(!token){
    window.location.replace("/index.html");
    return;
  }

  const stored = localStorage.getItem(THEME_KEY);
  if(stored === "day" || stored === "night"){
    setTheme(stored);
  }else{
    setTheme("day");
  }

  document
    .querySelectorAll('img[data-fallback="avatar"]')
    .forEach(attachAvatarFallback);

  const storedUser = loadStoredUser();
  if(!storedUser){
    window.location.replace("/index.html");
    return;
  }
  applyUser(storedUser);

  initHighlights();
  initTabs();
  wireEvents();

  const freshUser = await fetchProfileFromApi(token);
  if(freshUser){
    applyUser(freshUser);
  }
  await fetchUserPublications();
});

if(window.postComposer){
  window.postComposer.registerListener((publication) => {
    if(publication?.isOwn){
      state.collections.posts.unshift(publication);
      if(postsCountEl) postsCountEl.textContent = state.collections.posts.length.toString();
      renderGallery(state.currentTab);
    }
  });
}
