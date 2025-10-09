const body = document.body;
const form = document.getElementById("profile-form");
const nickInput = document.getElementById("settings-nick");
const currentPasswordInput = document.getElementById("settings-current-password");
const newPasswordInput = document.getElementById("settings-new-password");
const avatarInput = document.getElementById("settings-avatar");
const avatarPreview = document.getElementById("settings-avatar-preview");
const messageBox = document.getElementById("profile-message");
const themeToggle = document.getElementById("profile-theme-toggle");

const THEME_KEY = "feedTheme";
const USER_KEY = "user";
const AVATAR_FALLBACK =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";
const AVATAR_DEFAULT = "/media/iconobase.png";

let currentUser = null;
let previewObjectUrl = null;

function setTheme(mode){
  body.classList.toggle("theme-day", mode === "day");
  body.classList.toggle("theme-night", mode === "night");
  localStorage.setItem(THEME_KEY, mode);
}

function toggleTheme(){
  const current = body.classList.contains("theme-day") ? "day" : "night";
  setTheme(current === "day" ? "night" : "day");
}

function loadStoredTheme(){
  const stored = localStorage.getItem(THEME_KEY);
  if(stored === "day" || stored === "night"){
    setTheme(stored);
  }else{
    setTheme("day");
  }
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

function setMessage(text, type = "info"){
  if(!messageBox) return;
  messageBox.textContent = text || "";
  messageBox.classList.remove("error", "success");
  if(type === "error"){
    messageBox.classList.add("error");
  }else if(type === "success"){
    messageBox.classList.add("success");
  }
}

function attachAvatarFallback(img){
  if(!img) return;
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

const normalizeAvatar = (value) => {
  if(!value) return null;
  const trimmed = value.trim();
  if(!trimmed) return null;
  if(trimmed === "default.png") return AVATAR_DEFAULT;
  if(/^https?:\/\//i.test(trimmed)) return trimmed;
  if(trimmed.startsWith("/")) return trimmed;
  if(trimmed.startsWith("./")) return normalizeAvatar(trimmed.slice(2));
  if(trimmed.startsWith("media/") || trimmed.startsWith("uploads/")) return `/${trimmed}`;
  return `/media/${trimmed}`;
};

function applyUser(user){
  if(!user) return;
  currentUser = user;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if(nickInput){
    nickInput.value = user.nick || "";
  }
  if(avatarPreview){
    const avatarUrl = normalizeAvatar(user.avatar || user.image || user.photo);
    avatarPreview.classList.remove("is-fallback");
    avatarPreview.src = avatarUrl || AVATAR_DEFAULT;
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
    return data?.user || null;
  }catch(err){
    console.warn("No se pudo sincronizar el perfil", err);
    return null;
  }
}

function resetPreview(){
  if(previewObjectUrl){
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  if(currentUser && avatarPreview){
    const avatarUrl = normalizeAvatar(currentUser.avatar || currentUser.image || currentUser.photo);
    avatarPreview.classList.remove("is-fallback");
    avatarPreview.src = avatarUrl || AVATAR_DEFAULT;
  }
}

async function handleSubmit(event){
  event.preventDefault();
  const token = localStorage.getItem("token");
  if(!token){
    window.location.replace("/index.html");
    return;
  }

  const nickValue = nickInput.value.trim();
  if(!nickValue){
    setMessage("El nick no puede estar vacío", "error");
    return;
  }

  const hasCurrent = Boolean(currentPasswordInput.value);
  const hasNew = Boolean(newPasswordInput.value);
  if(hasCurrent !== hasNew){
    setMessage("Para cambiar la contraseña completa ambos campos.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("nick", nickValue);
  if(hasCurrent){
    formData.append("currentPassword", currentPasswordInput.value);
    formData.append("newPassword", newPasswordInput.value);
  }
  if(avatarInput.files[0]){
    formData.append("avatar", avatarInput.files[0]);
  }

  setMessage("Guardando cambios...");

  try{
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { Authorization: token },
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if(res.status === 401 || res.status === 403){
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem("token");
      window.location.replace("/index.html");
      return;
    }
    if(!res.ok){
      const msg = data?.message || "No se pudo actualizar el perfil";
      setMessage(msg, "error");
      return;
    }

    if(data?.user){
      applyUser(data.user);
      resetPreview();
    }
    avatarInput.value = "";
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    setMessage(data?.message || "Perfil actualizado correctamente", "success");
  }catch(err){
    console.error(err);
    setMessage("Ocurrió un error inesperado al guardar.", "error");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if(!token){
    window.location.replace("/index.html");
    return;
  }

  loadStoredTheme();
  attachAvatarFallback(avatarPreview);

  const storedUser = loadStoredUser();
  if(storedUser){
    applyUser(storedUser);
  }

  const freshUser = await fetchProfileFromApi(token);
  if(freshUser){
    applyUser(freshUser);
  }else if(!storedUser){
    setMessage("No se pudo cargar tu información de perfil.", "error");
  }
});

form?.addEventListener("submit", handleSubmit);
themeToggle?.addEventListener("click", toggleTheme);

avatarInput?.addEventListener("change", () => {
  if(previewObjectUrl){
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  const file = avatarInput.files[0];
  if(!file){
    resetPreview();
    return;
  }
  previewObjectUrl = URL.createObjectURL(file);
  avatarPreview.classList.remove("is-fallback");
  avatarPreview.src = previewObjectUrl;
});
