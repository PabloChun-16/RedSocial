(() => {
  // El App Shell mueve y elimina #page-content, así que no podemos abortar
  // si no existe. Conservamos una referencia si está presente y usamos
  // comprobaciones seguras al acceder a él.
  const page = document.getElementById("page-content");

  const els = {
    threadList: document.getElementById("messages-thread-list"),
    searchInput: document.getElementById("messages-search-input"),
    placeholder: document.getElementById("messages-placeholder"),
    header: document.getElementById("messages-conversation-header"),
    body: document.getElementById("messages-conversation-body"),
    inputBar: document.getElementById("messages-conversation-input"),
    composeForm: document.getElementById("messages-compose-form"),
    composeText: document.getElementById("messages-compose-text"),
    alert: document.getElementById("messages-alert"),
    avatar: document.getElementById("messages-conversation-avatar"),
    name: document.getElementById("messages-conversation-name"),
    nick: document.getElementById("messages-conversation-nick"),
    meta: document.getElementById("messages-conversation-meta")
  };

  const state = {
    shell: null,
    threads: [],
    filteredThreads: [],
    searchTerm: "",
    conversationId: null,
    activeContactId: null,
    messages: [],
    loadingThreads: false,
    loadingConversation: false
  };

  const relativeTimeFormatter =
    typeof Intl !== "undefined" && Intl.RelativeTimeFormat
      ? new Intl.RelativeTimeFormat("es", { numeric: "auto" })
      : null;
  const timeFormatter =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? new Intl.DateTimeFormat("es", {
          hour: "2-digit",
          minute: "2-digit"
        })
      : null;
  const dateFormatter =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? new Intl.DateTimeFormat("es", {
          day: "numeric",
          month: "long",
          year: "numeric"
        })
      : null;

  let alertTimer = null;

  function normalizeAssetPath(value, fallbackFolder = ""){
    if(!value) return "/media/iconobase.png";
    const trimmed = value.trim();
    if(!trimmed) return "/media/iconobase.png";
    if(trimmed.toLowerCase() === "default.png" || trimmed.includes("iconobase")){
      return "/media/iconobase.png";
    }
    if(/^https?:\/\//i.test(trimmed)) return trimmed;
    const marker = "uploads/";
    const index = trimmed.toLowerCase().lastIndexOf(marker);
    if(index !== -1){
      const relative = trimmed.slice(index + marker.length).replace(/^[\\/]+/, "");
      return `/uploads/${relative}`;
    }
    const filename = trimmed.split(/[\\/]/).pop();
    if(filename){
      return fallbackFolder ? `/uploads/${fallbackFolder}/${filename}` : `/uploads/${filename}`;
    }
    return "/media/iconobase.png";
  }

  const threadSorter = (a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  };

  function normalizeThread(thread){
    if(!thread || typeof thread !== "object"){
      return null;
    }
    const rawContact =
      typeof thread.contact === "object" && thread.contact !== null
        ? thread.contact
        : typeof thread.contact === "string"
        ? { id: thread.contact }
        : {};
    const contactId =
      rawContact.id ||
      rawContact._id ||
      (typeof thread.contact === "string" ? thread.contact : null);
    if(!contactId){
      return null;
    }
    const name =
      typeof rawContact.name === "string" && rawContact.name.trim()
        ? rawContact.name.trim()
        : "";
    const nick =
      typeof rawContact.nick === "string" && rawContact.nick.trim()
        ? rawContact.nick.trim()
        : "";
    const displayName = name || nick || "Usuario sin nombre";
    const nickLabel = nick ? `@${nick}` : "";
    const avatar = normalizeAssetPath(
      rawContact.image || rawContact.avatar || "",
      "avatars"
    );
    const lastMessage =
      thread.lastMessage && typeof thread.lastMessage === "object"
        ? thread.lastMessage
        : null;
    return {
      contact: {
        id: contactId,
        name,
        nick,
        avatar,
        displayName,
        nickLabel
      },
      conversationId:
        thread.conversationId ||
        lastMessage?.conversationId ||
        thread.conversation?._id ||
        thread.conversation?.id ||
        null,
      preview: thread.preview || lastMessage?.text || "",
      lastMessageAt: thread.lastMessageAt || lastMessage?.createdAt || null,
      lastMessageSender:
        thread.lastMessageSender || lastMessage?.sender || lastMessage?.senderId || null,
      unread: Number.isFinite(Number(thread.unread)) ? Number(thread.unread) : 0,
      relationship: thread.relationship || { following: false, followedBy: false, friends: false },
      status: thread.status || "active"
    };
  }

  function tokenize(value = ""){
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function showAlert(message, { tone = "error", timeout = 4200 } = {}){
    if(!els.alert) return;
    clearTimeout(alertTimer);
    els.alert.textContent = message;
    els.alert.dataset.tone = tone;
    els.alert.hidden = false;
    els.alert.classList.add("is-visible");
    if(timeout > 0){
      alertTimer = setTimeout(() => {
        els.alert.classList.remove("is-visible");
        els.alert.hidden = true;
      }, timeout);
    }
  }

  function clearAlert(){
    if(!els.alert) return;
    clearTimeout(alertTimer);
    els.alert.classList.remove("is-visible");
    els.alert.hidden = true;
  }

  function formatRelativeTime(value){
    if(!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(date.getTime())) return "";
    if(relativeTimeFormatter){
      const diffMs = date.getTime() - Date.now();
      const minutes = Math.round(diffMs / 60000);
      if(Math.abs(minutes) < 60){
        return relativeTimeFormatter.format(minutes, "minute");
      }
      const hours = Math.round(diffMs / 3600000);
      if(Math.abs(hours) < 24){
        return relativeTimeFormatter.format(hours, "hour");
      }
      const days = Math.round(diffMs / 86400000);
      if(Math.abs(days) < 7){
        return relativeTimeFormatter.format(days, "day");
      }
    }
    return dateFormatter ? dateFormatter.format(date) : date.toLocaleDateString();
  }

  function formatTime(value){
    if(!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(date.getTime())) return "";
    return timeFormatter ? timeFormatter.format(date) : date.toLocaleTimeString();
  }

  function formatDateLabel(value){
    const date = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(date.getTime())) return "";
    const today = new Date();
    const diffDays = Math.floor((today.setHours(0,0,0,0) - new Date(date).setHours(0,0,0,0)) / 86400000);
    if(diffDays === 0) return "Hoy";
    if(diffDays === -1 || diffDays === 1) return diffDays === 1 ? "Ayer" : "Mañana";
    return dateFormatter ? dateFormatter.format(date) : date.toLocaleDateString();
  }

  function setLoadingConversation(loading){
    state.loadingConversation = loading;
    els.body.classList.toggle("is-loading", loading);
    if(els.composeForm){
      els.composeForm.classList.toggle("is-disabled", loading);
      els.composeForm.querySelector("button[type=\"submit\"]")?.setAttribute("aria-busy", String(loading));
    }
  }

  function setThreads(threads){
    let normalized = [];
    if(Array.isArray(threads)){
      normalized = threads
        .map((thread) => {
          try{
            return normalizeThread(thread);
          }catch(error){
            console.warn("messages:normalizeThread error", error, thread);
            return null;
          }
        })
        .filter(Boolean);
      try{
        normalized.sort(threadSorter);
      }catch(error){
        console.warn("messages:threadSorter error", error);
      }
    }
    state.threads = normalized;
    applyFilter();
  }

  function applyFilter(){
    if(!state.searchTerm){
      state.filteredThreads = [...state.threads];
    }else{
      const token = tokenize(state.searchTerm);
      state.filteredThreads = state.threads.filter((thread) => {
        const haystack = `${thread?.contact?.displayName || ""} ${thread?.contact?.nickLabel || ""}`.trim();
        return tokenize(haystack).includes(token);
      });
    }
    renderThreads();
  }

  function renderThreads(){
    if(!els.threadList) return;
    els.threadList.innerHTML = "";
    if(!state.filteredThreads.length){
      const empty = document.createElement("p");
      empty.className = "messages-thread-empty";
      empty.textContent = state.searchTerm
        ? "No encontramos conversaciones que coincidan con tu búsqueda."
        : "Aún no tienes conversaciones. Sigue a alguien o acepta una solicitud para comenzar.";
      els.threadList.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    state.filteredThreads.forEach((thread) => {
      if(!thread?.contact?.id) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "messages-thread";
      if(thread.conversationId && state.conversationId === thread.conversationId){
        button.classList.add("is-active");
      }else if(!thread.conversationId && state.activeContactId === thread.contact.id){
        button.classList.add("is-active");
      }
      if(thread.unread > 0){
        button.classList.add("has-unread");
      }
      button.dataset.contactId = thread.contact.id;
      if(thread.conversationId){
        button.dataset.conversationId = thread.conversationId;
      }

      const avatar = document.createElement("span");
      avatar.className = "messages-thread__avatar";
      const avatarImg = document.createElement("img");
      avatarImg.src = thread.contact.avatar || "/media/iconobase.png";
      avatarImg.alt = thread.contact.displayName || "Avatar";
      avatarImg.dataset.fallback = "avatar";
      avatar.appendChild(avatarImg);
      fragment.appendChild(button);
      button.appendChild(avatar);
      state.shell?.attachAvatarFallback?.(avatarImg);

      const body = document.createElement("div");
      body.className = "messages-thread__body";
      const row = document.createElement("div");
      row.className = "messages-thread__row";
      const name = document.createElement("span");
      name.className = "messages-thread__name";
      name.textContent = thread.contact.displayName;
      row.appendChild(name);
      const time = document.createElement("time");
      time.className = "messages-thread__time";
      time.dateTime = thread.lastMessageAt || "";
      time.textContent = thread.lastMessageAt ? formatRelativeTime(thread.lastMessageAt) : "";
      row.appendChild(time);
      body.appendChild(row);
      const preview = document.createElement("div");
      preview.className = "messages-thread__preview";
      const previewPrefix =
        thread.lastMessageSender && state.shell?.getUser?.()?.id === thread.lastMessageSender
          ? "Tú: "
          : "";
      preview.textContent =
        previewPrefix + (thread.preview || "Aún no hay mensajes en esta conversación");
      body.appendChild(preview);
      button.appendChild(body);

      if(thread.unread > 0){
        const badge = document.createElement("span");
        badge.className = "messages-thread__badge";
        badge.textContent = thread.unread.toString();
        button.appendChild(badge);
      }
    });
    els.threadList.appendChild(fragment);
  }

  function renderPlaceholder(){
    if(!els.placeholder) return;
    els.placeholder.hidden = false;
    if(els.header) els.header.hidden = true;
    if(els.inputBar) els.inputBar.hidden = true;
    els.body.innerHTML = "";
  }

  function renderConversationHeader(conversation){
    if(!els.header) return;
    const contact = conversation.contact || {};
    els.header.hidden = false;
    if(els.placeholder) els.placeholder.hidden = true;
    els.name.textContent = contact.name || contact.nick || "Sin nombre";
    els.nick.textContent = contact.nick ? `@${contact.nick}` : "";
    const avatar = normalizeAssetPath(contact.image || "", "avatars");
    if(els.avatar){
      els.avatar.src = avatar;
      els.avatar.alt = contact.name || contact.nick || "Avatar";
      state.shell?.attachAvatarFallback?.(els.avatar);
    }
    if(els.meta){
      const relationship = conversation.relationship || {};
      let descriptor = "";
      if(relationship.friends){
        descriptor = "Se siguen mutuamente";
      }else if(relationship.following){
        descriptor = "Lo sigues";
      }else if(relationship.followedBy){
        descriptor = "Te sigue";
      }else{
        descriptor = "No se siguen";
      }
      els.meta.textContent = descriptor;
    }
  }

  function renderMessages(messages){
    els.body.innerHTML = "";
    if(!Array.isArray(messages) || !messages.length){
      const empty = document.createElement("div");
      empty.className = "conversation-placeholder";
      empty.innerHTML = `
        <div class="conversation-placeholder__icon">✨</div>
        <h2>No hay mensajes todavía</h2>
        <p>¡Escribe el primer mensaje para iniciar la conversación!</p>
      `;
      els.body.appendChild(empty);
      return;
    }
    let lastDateKey = "";
    messages.forEach((message) => {
      const createdAt = message.createdAt ? new Date(message.createdAt) : new Date();
      const dateKey = createdAt.toDateString();
      if(dateKey !== lastDateKey){
        const separator = document.createElement("div");
        separator.className = "message-separator";
        separator.textContent = formatDateLabel(createdAt);
        els.body.appendChild(separator);
        lastDateKey = dateKey;
      }
      const row = document.createElement("div");
      row.className = "message-row";
      if(message.isOwn){
        row.classList.add("is-own");
      }
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.textContent = message.text || "";
      row.appendChild(bubble);
      const meta = document.createElement("span");
      meta.className = "message-meta";
      meta.textContent = formatTime(createdAt);
      row.appendChild(meta);
      els.body.appendChild(row);
    });
    scrollConversationToBottom({ smooth: false });
  }

  function renderConversation(conversation){
    renderConversationHeader(conversation);
    renderMessages(conversation.messages || state.messages);
    if(els.inputBar){
      els.inputBar.hidden = false;
    }
  }

  function scrollConversationToBottom({ smooth = true } = {}){
    if(!els.body) return;
    const behavior = smooth ? "smooth" : "auto";
    requestAnimationFrame(() => {
      els.body.scrollTo({
        top: els.body.scrollHeight,
        behavior
      });
    });
  }

  function updateThreadSummary({ contactId, contact, conversationId, preview, lastMessageAt, unread, lastMessageSender }){
    if(!contactId) return;
    const idx = state.threads.findIndex((thread) => thread.contact.id === contactId);
    if(idx === -1){
      const newThread = normalizeThread({
        contact: { id: contactId, ...contact },
        conversationId,
        preview,
        lastMessageAt,
        unread,
        lastMessageSender
      });
      state.threads.push(newThread);
    }else{
      const thread = state.threads[idx];
      if(contact){
        const mergedContact = {
          ...thread.contact,
          ...contact,
          id: contactId
        };
        mergedContact.avatar = normalizeAssetPath(contact.image || thread.contact.avatar, "avatars");
        mergedContact.displayName = mergedContact.name?.trim?.() || mergedContact.nick || thread.contact.displayName;
        mergedContact.nickLabel = mergedContact.nick ? `@${mergedContact.nick}` : thread.contact.nickLabel;
        thread.contact = mergedContact;
      }
      if(conversationId){
        thread.conversationId = conversationId;
      }
      if(typeof unread === "number"){
        thread.unread = Math.max(0, unread);
      }
      if(preview !== undefined){
        thread.preview = preview;
      }
      if(lastMessageAt){
        thread.lastMessageAt = lastMessageAt;
      }
      if(lastMessageSender){
        thread.lastMessageSender = lastMessageSender;
      }
      state.threads[idx] = thread;
    }
    state.threads.sort(threadSorter);
    applyFilter();
  }

  function highlightActive(contactId){
    state.activeContactId = contactId;
    const buttons = els.threadList?.querySelectorAll(".messages-thread") || [];
    buttons.forEach((btn) => {
      const matchesContact = btn.dataset.contactId === contactId;
      const matchesConversation =
        state.conversationId && btn.dataset.conversationId === state.conversationId;
      const active = matchesContact || matchesConversation;
      btn.classList.toggle("is-active", active);
      if(active){
        btn.classList.remove("has-unread");
        const badge = btn.querySelector(".messages-thread__badge");
        if(badge) badge.remove();
      }
    });
  }

  async function apiFetch(url, options = {}){
    const token = localStorage.getItem("token");
    if(!token){
      window.location.href = "/";
      throw new Error("La sesión ha expirado");
    }
    const headers = { ...(options.headers || {}), Authorization: token };
    if(options.body && !(options.body instanceof FormData)){
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if(res.status === 401 || res.status === 403){
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/";
      throw new Error(data?.message || "Tu sesión ya no es válida");
    }
    if(!res.ok){
      throw new Error(data?.message || "No se pudo completar la operación");
    }
    return data;
  }

  async function loadThreads(){
    if(state.loadingThreads) return;
    state.loadingThreads = true;
    try{
      const data = await apiFetch("/api/messages/threads");
      setThreads(data.threads || []);
      if(typeof data.totalUnread === "number"){
        state.shell?.setMessagesUnread?.(data.totalUnread, { notify: false });
      }
    }catch(error){
      showAlert(error.message || "No se pudieron cargar tus chats");
    }finally{
      state.loadingThreads = false;
    }
  }

  async function openConversationBy({ conversationId, contactId, focusComposer = false }){
    if(state.loadingConversation) return;
    setLoadingConversation(true);
    clearAlert();
    try{
      let url = "";
      if(conversationId){
        url = `/api/messages/conversation/${conversationId}?limit=60`;
      }else if(contactId){
        url = `/api/messages/with/${contactId}?limit=60`;
      }else{
        throw new Error("No se pudo determinar la conversación solicitada");
      }
      const data = await apiFetch(url);
      const conversation = data.conversation;
      state.messages = conversation.messages || [];
      state.conversationId = conversation.id;
      state.activeContactId = conversation.contact?.id || contactId || null;
      renderConversation(conversation);
      updateThreadSummary({
        contactId: conversation.contact?.id,
        contact: conversation.contact,
        conversationId: conversation.id,
        preview: conversation.lastMessage?.text || state.messages.at(-1)?.text || "",
        lastMessageAt: conversation.lastMessage?.createdAt || state.messages.at(-1)?.createdAt || new Date().toISOString(),
        unread: 0,
        lastMessageSender: conversation.lastMessage?.sender
      });
      highlightActive(conversation.contact?.id);
      if(typeof data.totalUnread === "number"){
        state.shell?.setMessagesUnread?.(data.totalUnread, { notify: false });
      }
      if(focusComposer && els.composeText){
        requestAnimationFrame(() => els.composeText.focus());
      }
    }catch(error){
      showAlert(error.message || "No se pudo abrir la conversación");
    }finally{
      setLoadingConversation(false);
    }
  }

  function handleThreadClick(event){
    const button = event.target.closest(".messages-thread");
    if(!button || state.loadingConversation) return;
    const contactId = button.dataset.contactId;
    const conversationId = button.dataset.conversationId;
    openConversationBy({ conversationId, contactId, focusComposer: true });
  }

  function handleSearch(event){
    state.searchTerm = event.target.value || "";
    applyFilter();
  }

  function autoResizeTextarea(){
    if(!els.composeText) return;
    els.composeText.style.height = "auto";
    els.composeText.style.height = `${Math.min(els.composeText.scrollHeight, 180)}px`;
  }

  async function handleSend(event){
    event.preventDefault();
    if(state.loadingConversation || !state.activeContactId) return;
    const text = els.composeText.value.trim();
    if(!text){
      els.composeText.value = "";
      autoResizeTextarea();
      return;
    }
    const payload = { text };
    const submitBtn = els.composeForm.querySelector("button[type=\"submit\"]");
    submitBtn.disabled = true;
    try{
      const data = await apiFetch(`/api/messages/with/${state.activeContactId}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const message = data.message;
      if(message){
        state.messages.push(message);
        renderMessages(state.messages);
        updateThreadSummary({
          contactId: state.activeContactId,
          contact: data.conversation?.contact,
          conversationId: data.conversation?.id || state.conversationId,
          preview: message.text,
          lastMessageAt: message.createdAt,
          unread: 0,
          lastMessageSender: message.sender?.id || message.senderId || state.shell?.getUser?.()?.id
        });
        state.conversationId = data.conversation?.id || state.conversationId;
        highlightActive(state.activeContactId);
        scrollConversationToBottom({ smooth: true });
      }
      if(typeof data.totalUnread === "number"){
        state.shell?.setMessagesUnread?.(data.totalUnread, { notify: false });
      }
      els.composeText.value = "";
      autoResizeTextarea();
    }catch(error){
      showAlert(error.message || "No se pudo enviar el mensaje");
    }finally{
      submitBtn.disabled = false;
    }
  }

  function handleShellReady(shell){
    state.shell = shell;
    shell.setActiveSidebar?.("messages");
    shell.setSearchVisibility?.(false);
    shell.setFabVisible?.(false);
    if(page){ page.hidden = false; }
    loadThreads().then(() => handleInitialRoute());
    shell.onUser?.((user) => {
      if(!user){
        window.location.href = "/";
      }
    });
  }

  function handleInitialRoute(){
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get("conversation");
    const userId = params.get("user");
    if(conversationId){
      const existing = state.threads.find((thread) => thread.conversationId === conversationId);
      if(existing){
        openConversationBy({ conversationId: existing.conversationId, contactId: existing.contact.id, focusComposer: params.get("focus") === "compose" });
      }else{
        openConversationBy({ conversationId, focusComposer: params.get("focus") === "compose" });
      }
    }else if(userId){
      const existing = state.threads.find((thread) => thread.contact.id === userId);
      if(existing){
        openConversationBy({ conversationId: existing.conversationId, contactId: userId, focusComposer: true });
      }else{
        openConversationBy({ contactId: userId, focusComposer: true });
      }
    }else if(state.filteredThreads.length){
      highlightActive(state.filteredThreads[0].contact.id);
    }else{
      renderPlaceholder();
    }
  }

  function init(){
    els.threadList?.addEventListener("click", handleThreadClick);
    els.searchInput?.addEventListener("input", handleSearch);
    els.composeText?.addEventListener("input", autoResizeTextarea);
    els.composeForm?.addEventListener("submit", handleSend);
    autoResizeTextarea();

    if(window.appShell?.isReady){
      handleShellReady(window.appShell);
    }else{
      document.addEventListener(
        "appshell:ready",
        (event) => handleShellReady(event.detail),
        { once: true }
      );
    }
  }

  init();
})();
