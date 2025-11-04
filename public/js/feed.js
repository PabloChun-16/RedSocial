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

  function clamp01(value){
    if(typeof value !== "number" || Number.isNaN(value)) return 0;
    if(value < 0) return 0;
    if(value > 1) return 1;
    return value;
  }

  function getUserId(user){
    if(!user) return null;
    if(typeof user === "string") return user;
    const id = user.id || user._id || user._id?.toString?.();
    if(typeof id === "string") return id;
    return null;
  }

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
  const SEARCH_STATE = {
    active: false,
    query: "",
    loading: false,
    error: ""
  };
  const STORY_STATE = {
    groups: [],
    pulseTimer: null
  };
  const STORY_DURATION_MS = 3000;
  const FEED_SKELETON_COUNT = 4;

  const AVATAR_DEFAULT = "/media/iconobase.png";
  const AVATAR_FALLBACK =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";

  let feedGrid = null;
  let feedEmpty = null;
  let feedSearchHeader = null;
  let shell = null;
  let storiesRail = null;
  let storiesAddBtn = null;
  let storyViewer = null;
  let appUser = null;
  const FEED_EMPTY_DEFAULT = { title: "", subtitle: "" };
  const relativeTime =
    typeof Intl !== "undefined" && Intl.RelativeTimeFormat
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

  function normalizeOwner(owner){
    if(!owner || typeof owner !== "object") return null;
    return {
      ...owner,
      image: normalizeAssetPath(owner.image || owner.avatar || owner.photo || "", "avatars") || AVATAR_DEFAULT
    };
  }

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

  function formatRelativeTime(value){
    if(!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(date?.getTime?.())) return "";
    const diffMs = date.getTime() - Date.now();
    const minutes = Math.round(diffMs / 60000);
    if(relativeTime){
      if(Math.abs(minutes) < 60){
        return relativeTime.format(minutes, "minute");
      }
      const hours = Math.round(diffMs / 3600000);
      if(Math.abs(hours) < 24){
        return relativeTime.format(hours, "hour");
      }
      const days = Math.round(diffMs / 86400000);
      if(Math.abs(days) < 7){
        return relativeTime.format(days, "day");
      }
    }
    return date.toLocaleString("es");
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
      filter:
        typeof publication.filter === "string" && publication.filter.trim()
          ? publication.filter.trim()
          : previous?.filter || "original",
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
      autoTags: Array.isArray(publication.autoTags) ? publication.autoTags : previous?.autoTags || [],
      comments: commentsSource,
      commentsCount:
        typeof publication.commentsCount === "number"
          ? publication.commentsCount
          : commentsSource.length,
      adjustments: normalizeAdjustments({
        ...(previous?.adjustments || {}),
        ...(publication.adjustments || {})
      })
    };
  }

  function buildPostTagsMarkup(post){
    const manual = Array.isArray(post.tags) ? post.tags : [];
    const auto = Array.isArray(post.autoTags) ? post.autoTags : [];
    if(!manual.length && !auto.length) return "";
    const chips = [];
    manual.forEach((tag) => {
      const cleaned = typeof tag === "string" ? tag.trim() : "";
      if(cleaned){
        chips.push(`<span class="post__tag">#${escapeHtml(cleaned)}</span>`);
      }
    });
    auto.forEach((tag) => {
      const cleaned = typeof tag === "string" ? tag.trim() : "";
      if(cleaned){
        chips.push(`<span class="post__tag post__tag--auto">#${escapeHtml(cleaned)}</span>`);
      }
    });
    if(!chips.length) return "";
    return `<div class="post__tags">${chips.join("")}</div>`;
  }

  function getCurrentUser(){
    return shell?.getUser?.() || null;
  }

  function buildProfileUrl(user){
    if(!user) return "/profile.html";
    const currentId = getUserId(getCurrentUser());
    const ownerId = getUserId(user);
    if(currentId && ownerId && currentId === ownerId){
      return "/profile.html";
    }
    const nick = user.nick || user.username || "";
    if(nick){
      return `/profile-view.html?nick=${encodeURIComponent(nick)}`;
    }
    if(ownerId){
      return `/profile-view.html?id=${encodeURIComponent(ownerId)}`;
    }
    return "/profile.html";
  }

  function goToProfile(user){
    const url = buildProfileUrl(user);
    window.location.href = url;
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

  function normalizeStory(story, owner){
    if(!story || typeof story !== "object") return null;
    const normalizedOwner = normalizeOwner(owner || story.owner);
    const image =
      normalizeAssetPath(story.image || "", "stories") ||
      normalizeAssetPath(story.image || "", "posts") ||
      "/media/iconobase.png";
    const textBlocks = Array.isArray(story.textBlocks)
      ? story.textBlocks
          .map((block) => {
            if(!block || typeof block !== "object") return null;
            const text = typeof block.text === "string" ? block.text : "";
            if(!text.trim()) return null;
            return {
              ...block,
              text: text.trim(),
              color: typeof block.color === "string" && block.color.trim() ? block.color.trim() : "#ffffff",
              fontSize: Number.isFinite(block.fontSize) ? block.fontSize : 24,
              x: clamp01(Number.parseFloat(block.x)),
              y: clamp01(Number.parseFloat(block.y)),
              rotation: Number.isFinite(block.rotation) ? block.rotation : 0,
              align: block.align === "left" || block.align === "right" ? block.align : "center"
            };
          })
          .filter(Boolean)
      : [];
    return {
      ...story,
      image,
      owner: normalizedOwner,
      filter:
        typeof story.filter === "string" && story.filter.trim()
          ? story.filter.trim().toLowerCase()
          : "original",
      adjustments: normalizeAdjustments(story.adjustments),
      textBlocks,
      createdAt: story.createdAt || story.updatedAt || null,
      expiresAt: story.expiresAt || null
    };
  }

  function buildStoryCard(group, options = {}){
    if(!storiesRail) return null;
    const isSelf = Boolean(options.isSelf);
    const owner = normalizeOwner(group?.owner || (isSelf ? appUser : null));
    const ownerId = getUserId(owner) || (isSelf ? getUserId(appUser) : null);
    const stories = Array.isArray(group?.stories) ? group.stories : [];
    const hasStories = stories.length > 0;

    const card = document.createElement("article");
    card.className = "story";
    if(isSelf){
      card.classList.add("is-self");
    }
    if(!hasStories){
      card.classList.add("story--empty");
    }
    card.dataset.ownerId = ownerId || "";
    card.dataset.storyCount = stories.length.toString();
    card.tabIndex = 0;

    const ring = document.createElement("div");
    ring.className = "story-ring";
    const img = document.createElement("img");
    const avatarUrl = owner?.image || normalizeAssetPath(appUser?.image || appUser?.avatar || "", "avatars") || AVATAR_DEFAULT;
    img.src = avatarUrl;
    img.alt = owner?.name || owner?.nick || (isSelf ? "Tu historia" : "Historia");
    if(window.appShell){
      window.appShell.attachAvatarFallback(img);
    }else{
      img.addEventListener(
        "error",
        () => {
          img.src = AVATAR_FALLBACK;
        },
        { once: true }
      );
    }
    ring.appendChild(img);
    card.appendChild(ring);

    const nameSpan = document.createElement("span");
    nameSpan.className = "story-name";
    if(isSelf){
      const nick = appUser?.nick || appUser?.username || appUser?.email?.split("@")?.[0] || "Tú";
      nameSpan.textContent = appUser?.name?.split(" ")?.[0] || nick;
    }else{
      nameSpan.textContent = owner?.name?.split(" ")?.[0] || owner?.nick || "Historia";
    }
    card.appendChild(nameSpan);

    const hint = document.createElement("span");
    hint.className = "story-hint";
    if(isSelf && !hasStories){
      hint.textContent = "Añadir";
    }else if(isSelf){
      hint.textContent = "Ver historia";
    }else if(hasStories){
      const lastStory = stories[stories.length - 1];
      hint.textContent = lastStory?.createdAt ? formatRelativeTime(lastStory.createdAt) : "Reciente";
    }else{
      hint.textContent = "";
    }
    card.appendChild(hint);

    const openViewer = () => {
      if(isSelf && !hasStories){
        if(window.postComposer){
          window.postComposer.open("story");
        }
        return;
      }
      if(!ownerId) return;
      openStoryViewerForGroup(ownerId);
    };

    card.addEventListener("click", openViewer);
    card.addEventListener("keydown", (event) => {
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        openViewer();
      }
    });

    return card;
  }

  function updateStoriesPulse(){
    if(STORY_STATE.pulseTimer){
      clearInterval(STORY_STATE.pulseTimer);
      STORY_STATE.pulseTimer = null;
    }
    if(!storiesRail) return;
    const cards = Array.from(storiesRail.querySelectorAll(".story:not(.story--empty)"));
    if(!cards.length) return;
    let index = 0;
    cards.forEach((card, idx) => card.classList.toggle("pulse", idx === index));
    STORY_STATE.pulseTimer = setInterval(() => {
      cards.forEach((card, idx) => card.classList.toggle("pulse", idx === index));
      index = (index + 1) % cards.length;
    }, 4500);
  }

  function renderStoriesRail(){
    if(!storiesRail) return;
    storiesRail.innerHTML = "";
    const groups = Array.isArray(STORY_STATE.groups) ? STORY_STATE.groups : [];
    const currentUserId = getUserId(appUser);
    const selfGroup = groups.find((group) => getUserId(group.owner) === currentUserId);
    const others = groups.filter((group) => getUserId(group.owner) !== currentUserId && group.stories?.length);

    const selfCard = buildStoryCard(selfGroup || { owner: appUser, stories: [] }, { isSelf: true });
    if(selfCard){
      storiesRail.appendChild(selfCard);
    }

    others.forEach((group) => {
      const card = buildStoryCard(group, { isSelf: false });
      if(card) storiesRail.appendChild(card);
    });

    updateStoriesPulse();
  }


  function hydrateUserSection(user){
    if(!user) return;
    appUser = { ...(appUser || {}), ...user };
    renderStoriesRail();
  }

  function buildFeedSkeletonCard(index){
    const card = document.createElement("article");
    card.className = "post glass post--skeleton";
    card.setAttribute("aria-hidden", "true");
    card.tabIndex = -1;
    card.innerHTML = `
      <div class="post__header">
        <span class="skeleton skeleton--circle skeleton--avatar"></span>
        <div class="post__header-meta">
          <span class="skeleton skeleton--line skeleton--w-60"></span>
          <span class="skeleton skeleton--line skeleton--w-40"></span>
        </div>
      </div>
      <div class="post__media">
        <span class="skeleton skeleton--media" aria-hidden="true"></span>
      </div>
      <div class="post__actions post__actions--skeleton">
        <span class="skeleton skeleton--chip skeleton--w-40"></span>
        <span class="skeleton skeleton--chip skeleton--w-30"></span>
        <span class="skeleton skeleton--chip skeleton--w-35"></span>
      </div>
      <div class="post__caption">
        <span class="skeleton skeleton--line skeleton--w-80"></span>
        <span class="skeleton skeleton--line skeleton--w-50"></span>
      </div>`;
    card.dataset.index = index.toString();
    return card;
  }

  function showFeedSkeleton(count = FEED_SKELETON_COUNT){
    if(!feedGrid || !feedEmpty) return;
    feedGrid.hidden = false;
    feedEmpty.hidden = true;
    feedEmpty.style.display = "none";
    feedGrid.classList.add("is-skeleton");
    feedGrid.setAttribute("aria-busy", "true");
    feedGrid.dataset.state = "loading";
    feedGrid.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const total = Number.isFinite(count) && count > 0 ? count : FEED_SKELETON_COUNT;
    for(let i = 0; i < total; i += 1){
      fragment.appendChild(buildFeedSkeletonCard(i));
    }
    feedGrid.appendChild(fragment);
  }

  function clearFeedSkeleton(){
    if(!feedGrid) return;
    feedGrid.classList.remove("is-skeleton");
    if(feedGrid.dataset.state === "loading"){
      delete feedGrid.dataset.state;
    }
    feedGrid.removeAttribute("aria-busy");
  }

  function renderFeed(){
    if(!feedGrid || !feedEmpty) return;
    clearFeedSkeleton();
    feedGrid.innerHTML = "";
    feedGrid.dataset.state = SEARCH_STATE.active ? "search" : "feed";

    if(SEARCH_STATE.active){
      updateSearchHeader(FEED_STATE.posts.length);
    }else{
      updateSearchHeader(0);
    }

    if(!FEED_STATE.posts.length){
      updateFeedEmptyMessage();
      feedGrid.hidden = true;
      feedEmpty.hidden = false;
      feedEmpty.style.display = "";
      return;
    }

    updateFeedEmptyMessage();
    feedGrid.hidden = false;
    feedEmpty.hidden = true;
    feedEmpty.style.display = "none";

    FEED_STATE.posts.forEach((post, index) => {
      const normalized = sanitizePublicationForClient(post);
      const tagsMarkup = buildPostTagsMarkup(normalized);
      const ownerImage =
        normalizeAssetPath(normalized.owner?.image || AVATAR_DEFAULT, "avatars") ||
        AVATAR_DEFAULT;
      const ownerName =
        normalized.owner?.name?.split?.(" ")?.[0] || normalized.owner?.nick || "Usuario";
      const ownerNick = normalized.owner?.nick ? `@${normalized.owner.nick}` : "";
      const card = document.createElement("article");
      card.className = `post glass swing${index % 3 ? ` delay-${index % 3}` : ""}`;
      card.dataset.id = normalized.id;
      const isOwn = Boolean(
        normalized.isOwn ||
        (normalized.owner?.id && shell?.getUser?.()?.id && normalized.owner.id === shell.getUser().id)
      );
      const filterCss = buildFilterCss(normalized) || "none";
      const createdLabel = normalized.createdAt
        ? new Date(normalized.createdAt).toLocaleString()
        : "";
      card.innerHTML = `
        <div class="post__header" data-owner-id="${normalized.owner?.id || ""}" data-owner-nick="${normalized.owner?.nick || ""}">
          <button class="post__owner" type="button" aria-label="Ver perfil de ${ownerName}">
            <img src="${ownerImage}" alt="Avatar ${ownerName}" />
            <div>
              <h3>${ownerName}</h3>
              <span>${ownerNick} · ${createdLabel}</span>
            </div>
          </button>
          <button class="post__more-btn" type="button" aria-label="Opciones" ${isOwn ? "" : "hidden"}>
            <span class="icon icon-more" aria-hidden="true"></span>
          </button>
        </div>
        <figure class="post__media">
          <img src="${normalized.image}" alt="${normalized.caption || "Publicación"}" style="filter:${filterCss}" />
        </figure>
        <div class="post__actions">
          <button class="chip like${normalized.liked ? " is-active" : ""}" type="button" data-action="like" aria-pressed="${normalized.liked ? "true" : "false"}">♥ ${normalized.likes || 0}</button>
          <button class="chip comment" type="button" data-action="comments">💬 ${normalized.commentsCount || 0}</button>
          <button class="chip save${normalized.saved ? " is-active" : ""}" type="button" data-action="save">${normalized.saved ? "🔖 Guardado" : "📌 Guardar"}</button>
        </div>
        <p class="post__caption">${normalized.caption || "Sin descripción"}</p>
        ${tagsMarkup}
      `;
      const ownerButton = card.querySelector(".post__owner");
      if(ownerButton){
        ownerButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          goToProfile(normalized.owner);
        });
        ownerButton.addEventListener("keydown", (event) => {
          if(event.key === "Enter" || event.key === " "){
            event.preventDefault();
            event.stopPropagation();
            goToProfile(normalized.owner);
          }
        });
        const avatarImg = ownerButton.querySelector("img");
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
        const dateLabel = ownerButton.querySelector("span");
        if(dateLabel && normalized.createdAt){
          const createdAt = new Date(normalized.createdAt);
          dateLabel.textContent = `${ownerNick || ownerName} · ${createdAt.toLocaleString()}`;
        }
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

  function updateFeedEmptyMessage(){
    if(!feedEmpty) return;
    const title = feedEmpty.querySelector("h3");
    const subtitle = feedEmpty.querySelector("p");
    if(SEARCH_STATE.active){
      const query = SEARCH_STATE.query || "";
      if(title) title.textContent = SEARCH_STATE.error ? "No se pudo completar la búsqueda" : `No encontramos resultados para "${query}"`;
      if(subtitle){
        subtitle.textContent = SEARCH_STATE.error
          ? SEARCH_STATE.error
          : "Intenta con otras palabras o revisa tus etiquetas.";
      }
    }else{
      if(title) title.textContent = FEED_EMPTY_DEFAULT.title;
      if(subtitle) subtitle.textContent = FEED_EMPTY_DEFAULT.subtitle;
    }
  }

  function updateSearchHeader(resultCount){
    if(!feedSearchHeader) return;
    if(!SEARCH_STATE.active){
      feedSearchHeader.hidden = true;
      const title = feedSearchHeader.querySelector("h2");
      const detail = feedSearchHeader.querySelector("p");
      if(title) title.textContent = "";
      if(detail) detail.textContent = "";
      return;
    }
    const title = feedSearchHeader.querySelector("h2");
    const detail = feedSearchHeader.querySelector("p");
    if(title){
      const query = SEARCH_STATE.query || "";
      title.textContent = SEARCH_STATE.loading
        ? `Buscando "${query}"`
        : `Resultados para "${query}"`;
    }
    if(detail){
      if(SEARCH_STATE.loading){
        detail.textContent = "Estamos encontrando publicaciones que coinciden con tu búsqueda.";
      }else if(SEARCH_STATE.error){
        detail.textContent = SEARCH_STATE.error;
      }else if(resultCount === 0){
        detail.textContent = "No se encontraron publicaciones. Prueba con otras palabras o etiquetas.";
      }else if(resultCount === 1){
        detail.textContent = "1 publicación encontrada.";
      }else{
        detail.textContent = `${resultCount} publicaciones encontradas.`;
      }
    }
    feedSearchHeader.hidden = false;
  }

  async function performFeedSearch(query, { pushHistory = true } = {}){
    const trimmed = (query || "").trim();
    if(!trimmed){
      SEARCH_STATE.active = false;
      SEARCH_STATE.query = "";
      SEARCH_STATE.loading = false;
      SEARCH_STATE.error = "";
      updateSearchHeader(0);
      if(pushHistory){
        history.replaceState({}, "", "/feed.html");
      }
      if(shell?.setSearchValue){
        shell.setSearchValue("");
      }
      loadFeed();
      return;
    }

    SEARCH_STATE.active = true;
    SEARCH_STATE.query = trimmed;
    SEARCH_STATE.loading = true;
    SEARCH_STATE.error = "";
    if(shell?.setSearchValue){
      shell.setSearchValue(trimmed);
    }
    if(pushHistory){
      const url = `/feed.html?q=${encodeURIComponent(trimmed)}`;
      history.pushState({ q: trimmed }, "", url);
    }

    showFeedSkeleton();
    updateSearchHeader(0);

    try{
      const token = getToken();
      if(!token){
        throw new Error("Debes iniciar sesión para buscar publicaciones.");
      }
      const res = await fetch(`/api/search/posts?q=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || data?.error || `Error ${res.status} al buscar publicaciones`);
      }
      FEED_STATE.posts = [];
      if(Array.isArray(data.items)){
        data.items.forEach((item) => updatePostInState(item, { prepend: false }));
      }
      SEARCH_STATE.loading = false;
      SEARCH_STATE.error = "";
      renderFeed();
    }catch(error){
      console.error("performFeedSearch", error);
      SEARCH_STATE.loading = false;
      SEARCH_STATE.error = error.message || "No se pudo completar la búsqueda.";
      FEED_STATE.posts = [];
      renderFeed();
    }
  }

  function handleGlobalSearch(event){
    const query = event?.detail?.query ?? "";
    performFeedSearch(query, { pushHistory: true });
  }

  function handleSearchPopState(){
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    performFeedSearch(q, { pushHistory: false });
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

  async function loadStories(){
    const token = localStorage.getItem("token");
    if(!token) return;
    try{
      const res = await fetch("/api/stories", {
        headers: { Authorization: token }
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(data?.message || `Error ${res.status} al cargar historias`);
      }
      const rawGroups = Array.isArray(data.items) ? data.items : [];
      const normalizedGroups = rawGroups
        .map((group) => {
          const owner = normalizeOwner(group.owner);
          const stories = Array.isArray(group.stories)
            ? group.stories.map((story) => normalizeStory(story, owner)).filter(Boolean)
            : [];
          if(!owner) return null;
          const latestAt = stories.reduce((acc, item) => {
            const time = item?.createdAt ? new Date(item.createdAt).getTime() : 0;
            return Number.isFinite(time) && time > acc ? time : acc;
          }, 0);
          return {
            owner,
            stories,
            latestAt
          };
        })
        .filter(Boolean);

      const currentUserId = getUserId(appUser);
      const hasSelf = normalizedGroups.some((group) => getUserId(group.owner) === currentUserId);
      if(currentUserId && !hasSelf){
        normalizedGroups.unshift({
          owner: normalizeOwner(appUser),
          stories: [],
          latestAt: 0
        });
      }

      normalizedGroups.sort((a, b) => {
        const aId = getUserId(a.owner);
        const bId = getUserId(b.owner);
        if(aId === currentUserId && bId !== currentUserId) return -1;
        if(bId === currentUserId && aId !== currentUserId) return 1;
        return (b.latestAt || 0) - (a.latestAt || 0);
      });

      STORY_STATE.groups = normalizedGroups;
      renderStoriesRail();
    }catch(error){
      console.error("loadStories", error);
    }
  }

  async function loadFeed(){
    const token = localStorage.getItem("token");
    if(!token) return;
    if(!FEED_STATE.posts.length){
      showFeedSkeleton();
    }
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
      clearFeedSkeleton();
      if(feedEmpty){
        feedEmpty.hidden = false;
        const message = feedEmpty.querySelector("p");
        if(message) message.textContent = error.message;
      }
    }
  }

  function openStoryViewerForGroup(ownerId, initialIndex = 0){
    if(!ownerId) return;
    const groupsWithStories = (STORY_STATE.groups || []).filter((group) => Array.isArray(group.stories) && group.stories.length);
    if(!groupsWithStories.length) return;
    let targetIndex = groupsWithStories.findIndex((group) => getUserId(group.owner) === ownerId);
    if(targetIndex === -1) targetIndex = 0;
    if(!storyViewer){
      storyViewer = new StoryViewer({
        duration: STORY_DURATION_MS
      });
    }
    storyViewer.open(groupsWithStories, targetIndex, initialIndex);
  }

  class StoryViewer {
    constructor(options = {}){
      this.duration = Number.isFinite(options.duration) ? options.duration : STORY_DURATION_MS;
      this.groups = [];
      this.ownerIndex = 0;
      this.storyIndex = 0;
      this.timer = null;
      this.progressSegments = [];
      this.build();
      this.applyTheme(window.appShell?.getTheme?.());
      document.addEventListener("appshell:theme", (event) => {
        this.applyTheme(event?.detail);
      });
    }

    build(){
      this.backdrop = document.createElement("div");
      this.backdrop.className = "story-viewer";
      this.backdrop.innerHTML = `
        <div class="story-viewer__modal">
          <header class="story-viewer__head">
            <div class="story-viewer__identity">
              <div class="story-viewer__avatar"><img alt="" /></div>
              <div class="story-viewer__meta">
                <span class="story-viewer__name">&nbsp;</span>
                <span class="story-viewer__time">&nbsp;</span>
              </div>
            </div>
            <button type="button" class="story-viewer__close" aria-label="Cerrar historia">×</button>
          </header>
          <div class="story-progress"></div>
          <div class="story-viewer__body">
            <button type="button" class="story-viewer__nav story-viewer__nav--prev" aria-label="Historia anterior"></button>
            <div class="story-viewer__media">
              <img class="story-viewer__image" alt="Historia" />
              <div class="story-viewer__overlay"></div>
            </div>
            <button type="button" class="story-viewer__nav story-viewer__nav--next" aria-label="Siguiente historia"></button>
          </div>
        </div>
      `;
      document.body.appendChild(this.backdrop);

      this.modal = this.backdrop.querySelector(".story-viewer__modal");
      this.closeBtn = this.backdrop.querySelector(".story-viewer__close");
      this.imageEl = this.backdrop.querySelector(".story-viewer__image");
      this.overlayEl = this.backdrop.querySelector(".story-viewer__overlay");
      this.progressContainer = this.backdrop.querySelector(".story-progress");
      this.prevBtn = this.backdrop.querySelector(".story-viewer__nav--prev");
      this.nextBtn = this.backdrop.querySelector(".story-viewer__nav--next");
      this.nameEl = this.backdrop.querySelector(".story-viewer__name");
      this.timeEl = this.backdrop.querySelector(".story-viewer__time");
      this.avatarImg = this.backdrop.querySelector(".story-viewer__avatar img");
      this.identityEl = this.backdrop.querySelector(".story-viewer__identity");

      this.closeBtn.addEventListener("click", () => this.close());
      this.backdrop.addEventListener("click", (event) => {
        if(event.target === this.backdrop){
          this.close();
        }
      });
      this.prevBtn.addEventListener("click", () => this.prev(true));
      this.nextBtn.addEventListener("click", () => this.next(true));
      document.addEventListener("keydown", (event) => {
        if(!this.isOpen()) return;
        if(event.key === "Escape"){
          event.preventDefault();
          this.close();
        }else if(event.key === "ArrowRight"){
          event.preventDefault();
          this.next(true);
        }else if(event.key === "ArrowLeft"){
          event.preventDefault();
          this.prev(true);
        }
      });
    }

    applyTheme(mode){
      if(!this.backdrop) return;
      const inferred =
        mode ||
        window.appShell?.getTheme?.() ||
        (document.body.classList.contains("theme-day") ? "day" : "night");
      this.backdrop.classList.toggle("is-day", inferred === "day");
    }

    isOpen(){
      return this.backdrop?.classList.contains("is-visible") ?? false;
    }

    open(groups, ownerIndex = 0, storyIndex = 0){
      if(!Array.isArray(groups) || !groups.length) return;
      this.stopTimer();
      this.groups = groups;
      this.ownerIndex = Math.max(0, Math.min(ownerIndex, groups.length - 1));
      const currentStories = this.groups[this.ownerIndex]?.stories || [];
      this.storyIndex = Math.max(0, Math.min(storyIndex, currentStories.length - 1));
      this.backdrop.classList.add("is-visible");
      document.body.classList.add("story-viewer-open");
      this.renderCurrent();
    }

    close(){
      this.stopTimer();
      this.backdrop.classList.remove("is-visible");
      document.body.classList.remove("story-viewer-open");
    }

    renderCurrent(){
      this.stopTimer();
      const group = this.groups[this.ownerIndex];
      if(!group){
        this.close();
        return;
      }
      const stories = Array.isArray(group.stories) ? group.stories : [];
      if(!stories.length){
        this.next();
        return;
      }
      if(this.storyIndex >= stories.length){
        this.storyIndex = stories.length - 1;
      }
      if(this.storyIndex < 0){
        this.storyIndex = 0;
      }
      const story = stories[this.storyIndex];
      if(!story){
        this.close();
        return;
      }

      const owner = normalizeOwner(group.owner) || normalizeOwner(appUser);
      if(owner){
        if(this.avatarImg){
          this.avatarImg.src = owner.image || AVATAR_DEFAULT;
          this.avatarImg.alt = owner.name || owner.nick || "Autor";
        }
        if(this.nameEl){
          this.nameEl.textContent = owner.name?.split(" ")?.[0] || owner.nick || "Historia";
        }
        if(this.identityEl){
          this.identityEl.dataset.ownerId = owner.id || "";
          this.identityEl.dataset.ownerNick = owner.nick || "";
          this.identityEl.tabIndex = 0;
          this.identityEl.onclick = (event) => {
            event.preventDefault();
            this.close();
            goToProfile(owner);
          };
          this.identityEl.onkeydown = (event) => {
            if(event.key === "Enter" || event.key === " "){
              event.preventDefault();
              this.close();
              goToProfile(owner);
            }
          };
          this.identityEl.classList.add("is-clickable");
        }
      }else{
        if(this.avatarImg){
          this.avatarImg.src = AVATAR_DEFAULT;
          this.avatarImg.alt = "Historia";
        }
        if(this.nameEl){
          this.nameEl.textContent = "Historia";
        }
        if(this.identityEl){
          this.identityEl.onclick = null;
          this.identityEl.onkeydown = null;
          this.identityEl.classList.remove("is-clickable");
          this.identityEl.removeAttribute("tabindex");
        }
      }

      if(this.timeEl){
        this.timeEl.textContent = story.createdAt ? formatRelativeTime(story.createdAt) : "Reciente";
      }

      if(this.imageEl){
        const filterCss = buildFilterCss(story) || "none";
        this.imageEl.style.filter = filterCss;
        if(this.imageEl.src !== story.image){
          this.imageEl.classList.remove("is-loaded");
          this.imageEl.onload = () => {
            this.imageEl.classList.add("is-loaded");
          };
          this.imageEl.onerror = () => {
            this.imageEl.classList.add("is-loaded");
          };
          this.imageEl.src = story.image;
        }
      }

      this.renderOverlay(story);
      this.renderProgress(group);
      this.startTimer();
    }

    renderOverlay(story){
      if(!this.overlayEl) return;
      this.overlayEl.innerHTML = "";
      if(!Array.isArray(story.textBlocks) || !story.textBlocks.length) return;
      story.textBlocks.forEach((block) => {
        if(!block) return;
        const node = document.createElement("div");
        node.className = "story-viewer__text";
        node.textContent = block.text || "";
        node.style.color = block.color || "#ffffff";
        node.style.fontSize = `${Number.isFinite(block.fontSize) ? block.fontSize : 24}px`;
        const left = clamp01(Number.parseFloat(block.x || 0.5)) * 100;
        const top = clamp01(Number.parseFloat(block.y || 0.5)) * 100;
        node.style.left = `${left}%`;
        node.style.top = `${top}%`;
        node.style.transform = `translate(-50%, -50%) rotate(${block.rotation || 0}deg)`;
        node.style.textAlign = block.align || "center";
        this.overlayEl.appendChild(node);
      });
    }

    renderProgress(group){
      if(!this.progressContainer) return;
      this.progressContainer.innerHTML = "";
      this.progressSegments = [];
      const stories = Array.isArray(group.stories) ? group.stories : [];
      stories.forEach((_, idx) => {
        const segment = document.createElement("div");
        segment.className = "story-progress__segment";
        const fill = document.createElement("div");
        fill.className = "story-progress__fill";
        if(idx < this.storyIndex){
          fill.style.width = "100%";
        }else if(idx === this.storyIndex){
          fill.style.width = "0%";
        }else{
          fill.style.width = "0%";
        }
        segment.appendChild(fill);
        this.progressContainer.appendChild(segment);
        this.progressSegments.push(fill);
      });
    }

    startTimer(){
      this.stopTimer();
      const fill = this.progressSegments?.[this.storyIndex];
      if(fill){
        fill.style.transition = "none";
        fill.style.width = "0%";
        requestAnimationFrame(() => {
          fill.style.transition = `width ${this.duration}ms linear`;
          fill.style.width = "100%";
        });
      }
      this.timer = setTimeout(() => this.next(), this.duration);
    }

    stopTimer(){
      if(this.timer){
        clearTimeout(this.timer);
        this.timer = null;
      }
    }

    next(manual = false){
      const group = this.groups[this.ownerIndex];
      if(!group){
        this.close();
        return;
      }
      const stories = Array.isArray(group.stories) ? group.stories : [];
      if(this.storyIndex < stories.length - 1){
        this.storyIndex += 1;
        this.renderCurrent();
        if(manual) this.startTimer();
        return;
      }
      if(this.ownerIndex < this.groups.length - 1){
        this.ownerIndex += 1;
        this.storyIndex = 0;
        this.renderCurrent();
        return;
      }
      this.close();
    }

    prev(manual = false){
      if(this.storyIndex > 0){
        this.storyIndex -= 1;
        this.renderCurrent();
        if(manual) this.startTimer();
        return;
      }
      if(this.ownerIndex > 0){
        this.ownerIndex -= 1;
        const prevStories = this.groups[this.ownerIndex]?.stories || [];
        this.storyIndex = prevStories.length ? prevStories.length - 1 : 0;
        this.renderCurrent();
        return;
      }
      this.renderCurrent();
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

  document.addEventListener("story:created", () => {
    loadStories();
  });

  function initFeed(appShellInstance){
    shell = appShellInstance;
    if(!shell) return;

    feedGrid = document.getElementById("feed-grid");
    feedEmpty = document.getElementById("feed-empty");
    feedSearchHeader = document.getElementById("feed-search-header");
    storiesRail = document.getElementById("stories-rail");
    storiesAddBtn = document.querySelector(".stories__add");
    if(!feedGrid || !feedEmpty || !storiesRail) return;

    const emptyTitle = feedEmpty.querySelector("h3");
    const emptySubtitle = feedEmpty.querySelector("p");
    FEED_EMPTY_DEFAULT.title = emptyTitle?.textContent || FEED_EMPTY_DEFAULT.title;
    FEED_EMPTY_DEFAULT.subtitle = emptySubtitle?.textContent || FEED_EMPTY_DEFAULT.subtitle;

    shell.setActiveSidebar("feed");
    shell.setSearchVisibility(true);
    shell.setSearchPlaceholder("Busca usuarios, lugares o momentos");
    shell.setFabVisible(true);

    const currentUser = shell.getUser();
    if(currentUser){
      hydrateUserSection(currentUser);
    }else{
      renderStoriesRail();
    }
    shell.onUser((user) => {
      hydrateUserSection(user);
      loadStories();
    });

    renderStoriesRail();
    loadStories();
    document.addEventListener("search:submitted", handleGlobalSearch);
    window.addEventListener("popstate", handleSearchPopState);

    const params = new URLSearchParams(window.location.search);
    const initialQuery = (params.get("q") || "").trim();
    if(initialQuery){
      if(shell?.setSearchValue){
        shell.setSearchValue(initialQuery);
      }
      performFeedSearch(initialQuery, { pushHistory: false });
    }else{
      loadFeed();
    }

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
