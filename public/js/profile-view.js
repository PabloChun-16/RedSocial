(() => {
  const AVATAR_DEFAULT = "/media/iconobase.png";

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

  const state = {
    profile: null,
    relationship: { following: false, followedBy: false, friends: false },
    posts: [],
    loadingFollow: false
  };

  const els = {
    heroAvatar: null,
    username: null,
    fullname: null,
    bio: null,
    tagline: null,
    role: null,
    statsPosts: null,
    statsFollowers: null,
    statsFollowing: null,
    gallery: null,
    galleryEmpty: null,
    followBtn: null,
    messageBtn: null
  };

  let shell = null;

  function setRefs(){
    els.heroAvatar = document.getElementById("profile-hero-avatar");
    els.username = document.getElementById("profile-username");
    els.fullname = document.getElementById("profile-fullname");
    els.bio = document.getElementById("profile-bio");
    els.tagline = document.getElementById("profile-tagline");
    els.role = document.getElementById("profile-role");
    els.statsPosts = document.getElementById("profile-posts-count");
    els.statsFollowers = document.getElementById("profile-followers-count");
    els.statsFollowing = document.getElementById("profile-following-count");
    els.gallery = document.getElementById("profile-grid");
    els.galleryEmpty = document.getElementById("profile-empty");
    els.followBtn = document.getElementById("follow-btn");
    els.messageBtn = document.getElementById("message-btn");
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

  function buildFilterCss(publication){
    const filterDef = FILTERS.find((filter) => filter.id === publication.filter) || FILTERS[0];
    const adjustments = normalizeAdjustments(publication.adjustments || {});
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

  function sanitizePublication(publication = {}, previous = null){
    if(window.publicationViewer?.normalize){
      return window.publicationViewer.normalize(publication, previous || undefined);
    }
    const normalizedImage =
      normalizeAssetPath(publication.image || previous?.image || "", "posts") ||
      previous?.image ||
      "/media/iconobase.png";
    const owner = publication.owner || previous?.owner || null;

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

  function formatNumber(value){
    if(typeof value !== "number") value = Number(value) || 0;
    if(value >= 1000){
      const thousands = value / 1000;
      return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
    }
    return `${value}`;
  }

  function updateHero(){
    const profile = state.profile;
    if(!profile) return;
    const nick = profile.nick || "usuario";
    const fullName = profile.name
      ? `${profile.name}${profile.surname ? ` ${profile.surname}` : ""}`
      : nick;
    const avatarUrl =
      normalizeAssetPath(profile.avatar || profile.image || "", "avatars") ||
      AVATAR_DEFAULT;

    if(els.username) els.username.textContent = `@${nick}`;
    if(els.fullname) els.fullname.textContent = fullName;
    if(els.bio){
      els.bio.textContent =
        profile.bio ||
        "Personaliza tu historia: comparte momentos, colecciona recuerdos y mantente cerca de tu círculo creativo.";
    }
    if(els.tagline) els.tagline.textContent = `Momentos de @${nick}`;
    if(els.role){
      els.role.textContent =
        profile.role && profile.role !== "ROLE_USER"
          ? profile.role.replace(/_/g, " ")
          : "Miembro de la comunidad";
    }
    if(els.heroAvatar){
      els.heroAvatar.src = avatarUrl;
      els.heroAvatar.alt = fullName;
      if(window.appShell?.attachAvatarFallback){
        window.appShell.attachAvatarFallback(els.heroAvatar);
      }
    }
    if(els.statsPosts){
      els.statsPosts.textContent = formatNumber(profile.stats?.posts ?? state.posts.length);
    }
    if(els.statsFollowers){
      els.statsFollowers.textContent = formatNumber(profile.stats?.followers ?? 0);
    }
    if(els.statsFollowing){
      els.statsFollowing.textContent = formatNumber(profile.stats?.following ?? 0);
    }
    updateFollowButton();
    updateMessageButton();
  }

  function updateFollowButton(){
    const followBtn = els.followBtn;
    if(!followBtn) return;
    const profile = state.profile;
    if(!profile || !profile.canFollow){
      followBtn.style.display = "none";
      return;
    }
    followBtn.style.display = "";
    followBtn.disabled = state.loadingFollow;
    followBtn.classList.remove("is-following", "is-friends");

    let label = "Seguir";
    if(state.relationship.friends){
      label = "Amigos";
      followBtn.classList.add("is-friends");
    }else if(state.relationship.following){
      label = "Siguiendo";
      followBtn.classList.add("is-following");
    }
    followBtn.textContent = state.loadingFollow ? "Procesando..." : label;
  }

  function canSendMessage(){
    return Boolean(state.relationship.following || state.relationship.followedBy);
  }

  function updateMessageButton(){
    if(!els.messageBtn) return;
    const enabled = Boolean(state.profile) && canSendMessage();
    els.messageBtn.disabled = !enabled;
    els.messageBtn.textContent = "Mensaje";
    els.messageBtn.setAttribute(
      "title",
      enabled
        ? "Enviar mensaje directo"
        : "Debes seguir o ser seguido para chatear"
    );
  }

  function renderPosts(){
    if(!els.gallery || !els.galleryEmpty) return;
    clearGallerySkeleton();
    const dataset = state.posts || [];
    if(dataset.length === 0){
      els.gallery.innerHTML = "";
      els.gallery.hidden = true;
      els.galleryEmpty.hidden = false;
      els.galleryEmpty.style.display = "";
      return;
    }
    els.gallery.hidden = false;
    els.galleryEmpty.hidden = true;
    els.galleryEmpty.style.display = "none";
    els.gallery.innerHTML = "";
    dataset.forEach((item) => {
      const card = document.createElement("article");
      card.className = "profile-card";
      card.dataset.id = item.id;
      const imageSrc = normalizeAssetPath(item.image, "posts") || "/media/iconobase.png";
      const filterCss = buildFilterCss(item) || "none";
      card.innerHTML = `
        <img src="${imageSrc}" alt="${item.caption || "Publicación"}" loading="lazy" style="filter:${filterCss};" />
        <div class="profile-card__overlay">
          <div class="profile-card__meta">
            <span>♥ ${formatNumber(item.likes || 0)}</span>
            <span>💬 ${formatNumber(item.commentsCount || 0)}</span>
          </div>
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

  function openPublicationModal(id){
    if(!window.publicationViewer || !id) return;
    const found = state.posts.find((item) => item.id === id);
    if(found){
      window.publicationViewer.open(found);
    }
    window.publicationViewer.openById(id);
  }

  async function fetchProfile(identifier){
    const token = localStorage.getItem("token");
    if(!token){
      window.location.replace("/index.html");
      return null;
    }
    try{
      const res = await fetch(`/api/user/public/${encodeURIComponent(identifier)}`, {
        headers: { Authorization: token }
      });
      if(res.status === 401 || res.status === 403){
        window.location.replace("/index.html");
        return null;
      }
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo obtener el perfil");
      }
      if(data?.user?.isSelf){
        window.location.replace("/profile.html");
        return null;
      }
      return data.user;
    }catch(error){
      console.error(error);
      alert(error.message || "No se pudo cargar el perfil solicitado.");
      window.location.replace("/feed.html");
      return null;
    }
  }

  async function fetchPosts(userId){
    const token = localStorage.getItem("token");
    if(!token) return [];
    try{
      const res = await fetch(`/api/publication/user/${encodeURIComponent(userId)}`, {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudieron cargar las publicaciones");
      }
      const items = Array.isArray(data.items) ? data.items : [];
      return items.map((item) => sanitizePublication(item));
    }catch(error){
      console.error(error);
      return [];
    }
  }

  function handleFollowResponse(payload){
    if(!state.profile || !payload) return;
    const stats = state.profile.stats || (state.profile.stats = { followers: 0, following: 0, posts: state.posts.length });
    if(payload.relationship){
      state.relationship = payload.relationship;
    }
    if(payload.counts?.target){
      const followers = payload.counts.target.followers ?? stats.followers;
      const following = payload.counts.target.following ?? stats.following;
      stats.followers = followers;
      stats.following = following;
    }
    if(payload.currentUser && shell){
      shell.setUser({ ...shell.getUser(), ...payload.currentUser });
    }
    if(els.statsFollowers){
      els.statsFollowers.textContent = formatNumber(state.profile.stats.followers ?? 0);
    }
    if(els.statsFollowing){
      els.statsFollowing.textContent = formatNumber(state.profile.stats.following ?? 0);
    }
    updateFollowButton();
    updateMessageButton();
  }

  async function requestFollow(action){
    if(!state.profile?.id) return;
    const token = localStorage.getItem("token");
    if(!token){
      window.location.replace("/index.html");
      return;
    }
    state.loadingFollow = true;
    updateFollowButton();
    try{
      const res = await fetch(`/api/follow/${state.profile.id}`, {
        method: action === "unfollow" ? "DELETE" : "POST",
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || "No se pudo actualizar el seguimiento");
      }
      handleFollowResponse(data);
    }catch(error){
      console.error(error);
      alert(error.message || "No se pudo completar la acción.");
    }finally{
      state.loadingFollow = false;
      updateFollowButton();
    }
  }

  function onFollowClick(){
    if(!state.profile?.canFollow || state.loadingFollow) return;
    const isFollowing = state.relationship.following;
    if(isFollowing){
      const nick = state.profile.nick ? `@${state.profile.nick}` : "este usuario";
      const confirmUnfollow = window.confirm(`¿Dejar de seguir a ${nick}?`);
      if(!confirmUnfollow) return;
      requestFollow("unfollow");
    }else{
      requestFollow("follow");
    }
  }

  function wireEvents(){
    if(els.followBtn){
      els.followBtn.addEventListener("click", onFollowClick);
    }
    if(els.messageBtn){
      els.messageBtn.addEventListener("click", () => {
        if(!state.profile?.id) return;
        if(!canSendMessage()){
          alert("Necesitas seguir o ser seguido por esta persona para chatear.");
          return;
        }
        const url = new URL("/messages.html", window.location.origin);
        url.searchParams.set("user", state.profile.id);
        url.searchParams.set("focus", "compose");
        window.location.href = url.toString();
      });
    }
    updateMessageButton();
  }

  async function initProfileView(appShell){
    shell = appShell;
    if(shell){
      shell.setActiveSidebar("profile");
      shell.setFabVisible(false);
      shell.setSearchVisibility(true);
      shell.setSearchPlaceholder("Busca creadores o momentos");
    }

    setRefs();
    wireEvents();
    showGallerySkeleton();

    const params = new URLSearchParams(window.location.search);
    const identifier = params.get("nick") || params.get("id");
    if(!identifier){
      window.location.replace("/profile.html");
      return;
    }

    const profile = await fetchProfile(identifier);
    if(!profile) return;
    state.profile = profile;
    state.profile.stats = state.profile.stats || { followers: 0, following: 0, posts: 0 };
    state.relationship = profile.relationship || state.relationship;
    updateHero();

    const posts = await fetchPosts(profile.id);
    state.posts = posts;
    if(typeof profile.stats === "object" && profile.stats){
      profile.stats.posts = typeof profile.stats.posts === "number" ? profile.stats.posts : posts.length;
    }
    if(els.statsPosts){
      els.statsPosts.textContent = formatNumber(profile.stats?.posts ?? posts.length);
    }
    renderPosts();
    clearGallerySkeleton();
    const page = document.getElementById("page-content");
    if(page){
      page.hidden = false;
    }
  }

  const start = () => {
    if(window.appShell?.isReady){
      initProfileView(window.appShell);
    }else{
      document.addEventListener("appshell:ready", (event) => {
        initProfileView(event.detail);
      }, { once: true });
    }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start);
  }else{
    start();
  }
})();
