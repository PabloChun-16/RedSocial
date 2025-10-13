const body = document.body;
const themeToggle = document.getElementById("feed-theme-toggle");
const profileNick = document.getElementById("profile-nick");
const profileAvatar = document.getElementById("profile-avatar");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const storyName = document.getElementById("story-name");
const storyAvatar = document.getElementById("story-avatar");
const profileName = document.getElementById("profile-name");
const profileTagline = document.getElementById("profile-tagline");
const logoutBtn = document.getElementById("logout-btn");
const feedGrid = document.getElementById("feed-grid");
const feedEmpty = document.getElementById("feed-empty");

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

const FEED_STATE = {
  posts: []
};

const normalizeAssetPath = (value, fallbackFolder = "") => {
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
};

const sanitizePublicationForClient = (publication = {}) => {
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
};

function attachAvatarFallback(img){
  if(!img) return;
  const fallback = img.dataset.fallback;
  if(fallback !== "avatar") return;
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

function loadCurrentUser(){
  try{
    const raw = localStorage.getItem(USER_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(err){
    console.warn("No se pudo leer el usuario almacenado", err);
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



function hydrateUserUI(user){
  if(!user) return;
  const nick = user.nick || user.username || user.email?.split("@")[0] || "invitado";
  if(profileNick) profileNick.textContent = `@${nick}`;
  if(profileName) profileName.textContent = user.name?.split(" ")[0] || nick;
  if(profileTagline) profileTagline.textContent = `Momentos de ${nick}`;
  if(storyName){
    storyName.textContent = user.name?.split(" ")[0] || nick;
  }
  const avatarUrl = normalizeAssetPath(user.avatar || user.image || user.photo, "avatars");
  if(profileAvatar){
    const finalSrc = avatarUrl || AVATAR_DEFAULT;
    profileAvatar.src = finalSrc;
    profileAvatar.alt = user.name || nick;
    profileAvatar.classList.toggle("is-fallback", finalSrc === AVATAR_DEFAULT);
  }
  if(storyAvatar){
    const finalSrc = avatarUrl || AVATAR_FALLBACK;
    storyAvatar.src = finalSrc;
    storyAvatar.classList.toggle("is-fallback", finalSrc === AVATAR_FALLBACK);
  }
  if(sidebarAvatar){
    const finalSrc = avatarUrl || AVATAR_DEFAULT;
    sidebarAvatar.src = finalSrc;
    sidebarAvatar.classList.toggle("is-fallback", finalSrc === AVATAR_DEFAULT);
  }
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
    feedEmpty.hidden = false;
    if(feedEmpty) feedEmpty.querySelector("p").textContent = error.message;
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

themeToggle?.addEventListener("click", toggleTheme);
logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("token");
  window.location.replace("/index.html");
});

document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem(THEME_KEY);
  if(stored === "day" || stored === "night"){
    setTheme(stored);
  }else{
    setTheme("day");
  }

  const user = loadCurrentUser();
  if(!user){
    window.location.replace("/index.html");
    return;
  }
  document
    .querySelectorAll('img[data-fallback="avatar"]')
    .forEach(attachAvatarFallback);
  hydrateUserUI(user);

  refreshUserFromApi().then((fresh) => {
    if(fresh){
      hydrateUserUI(fresh);
    }
  });

  const stories = document.querySelectorAll(".story");
  let index = 0;
  setInterval(() => {
    stories.forEach((story,i) => story.classList.toggle("pulse", i === index));
    index = (index + 1) % stories.length;
  }, 4500);

  loadFeed();
});
