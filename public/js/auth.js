// ---------- Tabs con transición ----------
const $tabLogin = document.getElementById("tab-login");
const $tabRegister = document.getElementById("tab-register");
const forms = {
  login: document.getElementById("form-login"),
  register: document.getElementById("form-register"),
};
const $msg = document.getElementById("msg");
const heroMedia = document.getElementById("hero-media");
const heroIndicators = document.getElementById("hero-indicators");
const heroCopyEl = heroMedia?.querySelector(".hero-copy");
const heroKicker = heroCopyEl?.querySelector(".hero-kicker");
const heroTitle = heroCopyEl?.querySelector(".hero-title");
const heroText = heroCopyEl?.querySelector(".hero-text");

const heroCopyContent = {
  login: {
    kicker: "Imagina, conecta, comparte",
    title: "Una red social<br />para imaginar.",
    text: "Descubre espacios creativos y comparte historias increíbles con tu comunidad.",
  },
  register: {
    kicker: "Explora nuevas conexiones",
    title: "Sé parte de<br />nuestro mundo.",
    text: "Crea tu cuenta y suma tu voz a una comunidad vibrante llena de inspiración.",
  },
};

const heroSlides = [
  { image: "/media/carrusel1.jpeg", position: "center" },
  { image: "/media/carrusel2.jpeg", position: "center" },
  { image: "/media/carrusel3.jpg", position: "center" },
];

const HERO_INTERVAL_MS = 8000;
const THEME_VIDEO_DELAY = 280;
const THEME_CLASS_DELAY = 520;
let heroIndex = 0;
let heroTimer;
let videoSwapTimer;

const GOOGLE_BUTTON_OPTIONS = {
  type: "standard",
  theme: "outline",
  size: "large",
  text: "continue_with",
  shape: "pill",
  logo_alignment: "left",
  width: "100%"
};

const apiBase = "";
const endpoints = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  google: "/api/auth/google",
  config: "/api/auth/config"
};

let authConfig = null;
let googleInitialized = false;
let recaptchaSiteKey = null;
let recaptchaWidgetId = null;
let recaptchaReady = false;

function setMsg(text, type = "info") {
  if (!text) {
    $msg.className = "msg";
    $msg.textContent = "";
    return;
  }
  $msg.className = `msg is-visible ${type}`;
  $msg.textContent = text;
}

function switchPanel(to) {
  const from = to === "login" ? "register" : "login";
  forms[from].classList.remove("active");
  forms[from].setAttribute("aria-hidden", "true");
  forms[to].classList.add("active");      // display:block + animación CSS
  forms[to].setAttribute("aria-hidden", "false");
}

function show(tab) {
  if (tab === "login") {
    $tabLogin.classList.add("active");
    $tabRegister.classList.remove("active");
    switchPanel("login");
    document.body.classList.remove("view-register");
    updateHeroCopy("login");
  } else {
    $tabRegister.classList.add("active");
    $tabLogin.classList.remove("active");
    switchPanel("register");
    document.body.classList.add("view-register");
    updateHeroCopy("register");
  }
  setMsg("");
}
$tabLogin.addEventListener("click", () => show("login"));
$tabRegister.addEventListener("click", () => show("register"));

// ---------- Mostrar/ocultar contraseña ----------
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".peek");
  if (!btn) return;
  const input = btn.previousElementSibling;
  if (input?.tagName === "INPUT") {
    input.type = input.type === "password" ? "text" : "password";
  }
});

// ---------- Helpers API ----------
async function postJSON(url, data, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      credentials: options.credentials || "include"
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: json };
  } catch (error) {
    console.error("Error de red al llamar POST", url, error);
    return {
      ok: false,
      status: 0,
      data: { message: "No fue posible conectar con el servidor. Intenta nuevamente." }
    };
  }
}

async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: options.credentials || "include",
      headers: options.headers || {}
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error de red al llamar GET", url, error);
    throw error;
  }
}

async function waitForGoogle() {
  if (window.google?.accounts?.id) return window.google.accounts.id;
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        resolve(window.google.accounts.id);
      } else if (attempts > 40) {
        clearInterval(timer);
        reject(new Error("Google script not loaded"));
      }
      attempts += 1;
    }, 100);
  });
}

async function waitForRecaptcha() {
  if (window.grecaptcha?.render) return window.grecaptcha;
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      const grecaptcha = window.grecaptcha;
      if (grecaptcha?.render) {
        clearInterval(timer);
        resolve(grecaptcha);
      } else if (attempts > 60) {
        clearInterval(timer);
        reject(new Error("reCAPTCHA no disponible"));
      }
      attempts += 1;
    }, 120);
  });
}

async function ensureAuthConfig() {
  if (authConfig) return authConfig;
  try {
    authConfig = await fetchJSON(apiBase + endpoints.config);
  } catch (error) {
    console.warn("No se pudo obtener la configuración de autenticación:", error);
    authConfig = {};
  }
  return authConfig;
}

async function initializeGoogleSignIn(clientId) {
  if (googleInitialized || !clientId) return;
  try {
    const accounts = await waitForGoogle();
    accounts.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true
    });
    renderGoogleButton("google-login-btn");
    renderGoogleButton("google-register-btn");
    googleInitialized = true;
  } catch (error) {
    console.warn("No se pudo inicializar Google Sign-In:", error);
  }
}

function renderGoogleButton(targetId) {
  const container = document.getElementById(targetId);
  if (!container || container.dataset.googleRendered === "true") return;
  try {
    window.google.accounts.id.renderButton(container, GOOGLE_BUTTON_OPTIONS);
    container.dataset.googleRendered = "true";
  } catch (error) {
    console.warn("No se pudo renderizar el botón de Google:", error);
  }
}

async function handleGoogleCredential(response) {
  const credential = response?.credential;
  if (!credential) {
    setMsg("No pudimos validar tu cuenta de Google. Intenta de nuevo.", "error");
    return;
  }
  setMsg("Conectando con Google...");
  const { ok, status, data } = await postJSON(apiBase + endpoints.google, { idToken: credential });
  if (!ok) {
    const message =
      data?.message || (status === 401 ? "No pudimos validar tu cuenta de Google. Intenta de nuevo." : `Error ${status} al conectar con Google`);
    setMsg(message, "error");
    return;
  }
  if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
  if (data?.token) localStorage.setItem("token", data.token);
  setMsg(`Bienvenido, ${data?.user?.name || data?.user?.nick || "usuario"} 👋`, "success");
  setTimeout(() => {
    window.location.href = "/feed.html";
  }, 750);
}

async function renderRecaptchaWidget() {
  if (!recaptchaSiteKey || recaptchaWidgetId !== null) return;
  try {
    const grecaptcha = await waitForRecaptcha();
    const container = document.getElementById("register-recaptcha");
    if (!container) return;
    recaptchaWidgetId = grecaptcha.render(container, {
      sitekey: recaptchaSiteKey,
      theme: document.body.classList.contains("theme-day") ? "light" : "dark"
    });
    recaptchaReady = true;
  } catch (error) {
    console.warn("No se pudo renderizar reCAPTCHA:", error);
  }
}

async function loadAuthIntegrations() {
  const config = await ensureAuthConfig();
  if (config.googleClientId) {
    await initializeGoogleSignIn(config.googleClientId);
  }
  if (config.recaptchaSiteKey) {
    recaptchaSiteKey = config.recaptchaSiteKey;
    await renderRecaptchaWidget();
  }
}

// ---------- Submit Login ----------
forms.login.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Iniciando sesión...");
  const payload = {
    email: document.getElementById("login-email").value.trim(),
    password: document.getElementById("login-password").value,
  };
  const { ok, status, data } = await postJSON(apiBase + endpoints.login, payload);
  if (!ok) return setMsg(data?.message || `Error ${status} al iniciar sesión`, "error");

  if (data?.token) localStorage.setItem("token", data.token);
  if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
  setMsg(`Bienvenido, ${data?.user?.name || data?.user?.nick || "usuario"} 👋`, "success");
  setTimeout(() => {
    window.location.href = "/feed.html";
  }, 750);
});

// ---------- Submit Registro ----------
forms.register.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!recaptchaSiteKey) {
    setMsg("No pudimos verificar que eres humano. Reintenta el captcha.", "error");
    return;
  }
  if (recaptchaWidgetId === null || typeof window.grecaptcha === "undefined") {
    await renderRecaptchaWidget();
  }
  if (recaptchaWidgetId === null || typeof window.grecaptcha === "undefined") {
    setMsg("No pudimos verificar que eres humano. Reintenta el captcha.", "error");
    return;
  }
  const recaptchaToken = window.grecaptcha.getResponse(recaptchaWidgetId);
  if (!recaptchaToken) {
    setMsg("No pudimos verificar que eres humano. Reintenta el captcha.", "error");
    return;
  }

  setMsg("Registrando usuario...");
  const payload = {
    name: document.getElementById("reg-name").value.trim(),
    nick: document.getElementById("reg-nick").value.trim(),
    email: document.getElementById("reg-email").value.trim().toLowerCase(),
    password: document.getElementById("reg-password").value,
    recaptchaToken
  };
  const { ok, status, data } = await postJSON(apiBase + endpoints.register, payload);
  if (window.grecaptcha && recaptchaWidgetId !== null) {
    window.grecaptcha.reset(recaptchaWidgetId);
  }
  if (!ok) return setMsg(data?.message || `Error ${status} al registrar`, "error");

  setMsg("Usuario registrado correctamente. Ahora inicia sesión.", "success");
  show("login");
});

// ---------- Intro al cargar ----------
window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("run-intro");
  // restaurar preferencia de tema
  const saved = localStorage.getItem("authTheme");
  if (saved === "day" || saved === "night") {
    applyThemeClasses(saved);
    scheduleVideoSwap(saved, { immediate: true, suppressTransition: true });
  }

  initHeroCarousel();
  loadAuthIntegrations().catch((error) =>
    console.warn("No se pudieron cargar las integraciones de autenticación:", error)
  );
});

// ---------- Toggle Día/Noche + fundido de video ----------
const $themeToggle = document.getElementById("theme-toggle");
const $video = document.getElementById("bgVideo");
let themeClassTimer;
let themeCleanupTimer;

function applyThemeClasses(mode) {
  const body = document.body;
  body.classList.toggle("theme-day", mode === "day");
  body.classList.toggle("theme-night", mode === "night");
  localStorage.setItem("authTheme", mode);
  $themeToggle?.setAttribute("aria-pressed", mode === "day");
}

function scheduleVideoSwap(mode, { immediate = false, suppressTransition = false } = {}) {
  const nextSrc = mode === "day" ? $video.dataset.day : $video.dataset.night;
  const nextPoster = mode === "day" ? "/media/fondo-dia.jpg" : "/media/fondo2.jpg";

  if (!nextSrc) return;

  const performSwap = () => {
    if ($video.currentSrc && $video.currentSrc.includes(nextSrc)) return;
    if (!suppressTransition) $video.classList.add("is-switching");
    const source = $video.querySelector("source");
    source.setAttribute("src", nextSrc);
    if (nextPoster) $video.setAttribute("poster", nextPoster);
    $video.load();
    $video.play().catch(() => {});

    if (!suppressTransition) {
      const clear = () => requestAnimationFrame(() => $video.classList.remove("is-switching"));
      const fallback = setTimeout(clear, 1600);
      $video.addEventListener(
        "loadeddata",
        () => {
          clearTimeout(fallback);
          clear();
        },
        { once: true }
      );
    }
  };

  if (immediate) {
    clearTimeout(videoSwapTimer);
    performSwap();
    return;
  }

  clearTimeout(videoSwapTimer);
  videoSwapTimer = setTimeout(performSwap, THEME_VIDEO_DELAY);
}

function setTheme(mode) {
  const body = document.body;
  const current = body.classList.contains("theme-day") ? "day" : "night";
  if (current === mode && !body.classList.contains("is-theme-transition")) return;

  clearTimeout(themeClassTimer);
  clearTimeout(themeCleanupTimer);

  body.classList.remove("is-theme-transition");
  delete body.dataset.themeTransition;
  void body.offsetWidth; // reflow to restart animation

  body.dataset.themeTransition = mode;
  body.classList.add("is-theme-transition");

  scheduleVideoSwap(mode);

  themeClassTimer = setTimeout(() => {
    applyThemeClasses(mode);
  }, THEME_CLASS_DELAY);

  const cleanup = () => {
    body.classList.remove("is-theme-transition");
    delete body.dataset.themeTransition;
  };

  themeCleanupTimer = setTimeout(cleanup, 1200);
}

$themeToggle?.addEventListener("click", () => {
  const current = document.body.classList.contains("theme-day") ? "day" : "night";
  setTheme(current === "day" ? "night" : "day");
});

// ---------- Carrusel hero izquierdo ----------
function buildHeroIndicators() {
  if (!heroIndicators) return;
  heroIndicators.innerHTML = "";
  heroSlides.forEach((_, idx) => {
    const dot = document.createElement("span");
    dot.className = "hero-dot" + (idx === heroIndex ? " is-active" : "");
    dot.dataset.index = String(idx);
    heroIndicators.appendChild(dot);
  });
}

function setHeroSlide(index) {
  if (!heroMedia) return;
  heroIndex = (index + heroSlides.length) % heroSlides.length;
  const slide = heroSlides[heroIndex];
  heroMedia.style.setProperty("--hero-image", `url('${slide.image}')`);
  heroMedia.style.setProperty("--hero-position", slide.position || "center");

  if (heroIndicators) {
    heroIndicators.querySelectorAll(".hero-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === heroIndex);
    });
  }
}

function nextHeroSlide() {
  setHeroSlide(heroIndex + 1);
}

function stopHeroRotation() {
  if (heroTimer) {
    clearInterval(heroTimer);
    heroTimer = undefined;
  }
}

function startHeroRotation() {
  if (heroSlides.length <= 1) return;
  stopHeroRotation();
  heroTimer = setInterval(nextHeroSlide, HERO_INTERVAL_MS);
}

function initHeroCarousel() {
  if (!heroMedia || heroSlides.length === 0) return;
  buildHeroIndicators();
  setHeroSlide(0);
  startHeroRotation();
}

heroIndicators?.addEventListener("click", (event) => {
  const dot = event.target.closest(".hero-dot");
  if (!dot) return;
  const idx = Number(dot.dataset.index || 0);
  setHeroSlide(idx);
  startHeroRotation();
});

document.addEventListener("visibilitychange", () => {
  if (!heroMedia || heroSlides.length <= 1) return;
  if (document.hidden) stopHeroRotation();
  else startHeroRotation();
});

function updateHeroCopy(mode) {
  if (!heroCopyEl) return;
  const copy = heroCopyContent[mode] || heroCopyContent.login;
  heroCopyEl.classList.remove("is-transitioning");
  // fuerza reflow para reiniciar la animación
  void heroCopyEl.offsetWidth;
  if (heroKicker) heroKicker.textContent = copy.kicker;
  if (heroTitle) heroTitle.innerHTML = copy.title;
  if (heroText) heroText.textContent = copy.text;
  heroCopyEl.classList.add("is-transitioning");
}

heroCopyEl?.addEventListener("animationend", () => {
  heroCopyEl.classList.remove("is-transitioning");
});
