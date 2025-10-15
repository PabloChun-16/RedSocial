(() => {
  const AVATAR_FALLBACK =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PGNpcmNsZSBjeD0nNTAnIGN5PSc1MCcgcj0nNDgnIGZpbGw9JyNmZmYnIGZpbGwtb3BhY2l0eT0nMC44Jy8+PHBhdGggZD0nTTE2LjkgODcuOGMuNi0zLjcgMi44LTYuOSA2LjgtNy45IDEwLjUtMi42IDQyLjEtNiA0Ni41LTEuNiAxLjcuOSA0LjQgNC43IDQuNCA3LjJWOThIMTd2LTguMnoiIGZpbGw9JyM2NDc4OUEnIG9wYWNpdHk9JzAuNScvPjxwYXRoIGQ9J00yOSAyOS4yYTE5IDE5IDAgMTE0MiAwIDE5IDE5IDAgMDEtNDIgMHonIGZpbGw9JyM3RDg4QjUnIG9wYWNpdHk9JzAuNycgLz48L3N2Zz4=";
  const AVATAR_DEFAULT = "/media/iconobase.png";

  const els = {};
  let shell = null;
  let currentUser = null;
  let previewObjectUrl = null;

  function setRefs(){
    els.form = document.getElementById("profile-form");
    els.nick = document.getElementById("settings-nick");
    els.currentPassword = document.getElementById("settings-current-password");
    els.newPassword = document.getElementById("settings-new-password");
    els.avatarInput = document.getElementById("settings-avatar");
    els.avatarPreview = document.getElementById("settings-avatar-preview");
    els.messageBox = document.getElementById("profile-message");
  }

  function setMessage(text, type = "info"){
    if(!els.messageBox) return;
    els.messageBox.textContent = text || "";
    els.messageBox.classList.remove("error", "success");
    if(type === "error"){
      els.messageBox.classList.add("error");
    }else if(type === "success"){
      els.messageBox.classList.add("success");
    }
  }

  function attachAvatarFallback(img){
    if(!img) return;
    if(shell){
      shell.attachAvatarFallback(img);
    }else{
      img.addEventListener("error", () => {
        img.src = AVATAR_FALLBACK;
      }, { once: true });
    }
  }

  function normalizeAvatar(value){
    if(!value) return AVATAR_DEFAULT;
    const trimmed = value.trim();
    if(!trimmed) return AVATAR_DEFAULT;
    if(trimmed === "default.png") return AVATAR_DEFAULT;
    if(/^https?:\/\//i.test(trimmed)) return trimmed;
    if(trimmed.startsWith("/")) return trimmed;
    if(trimmed.startsWith("./")) return normalizeAvatar(trimmed.slice(2));
    if(trimmed.startsWith("media/") || trimmed.startsWith("uploads/")) return `/${trimmed}`;
    return `/media/${trimmed}`;
  }

  function applyUser(user){
    if(!user) return;
    currentUser = user;
    if(els.nick){
      els.nick.value = user.nick || "";
    }
    if(els.avatarPreview){
      els.avatarPreview.classList.remove("is-fallback");
      els.avatarPreview.src = normalizeAvatar(user.avatar || user.image || user.photo);
      attachAvatarFallback(els.avatarPreview);
    }
  }

  function resetPreview(){
    if(previewObjectUrl){
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
    if(currentUser && els.avatarPreview){
      els.avatarPreview.classList.remove("is-fallback");
      els.avatarPreview.src = normalizeAvatar(currentUser.avatar || currentUser.image || currentUser.photo);
    }
  }

  async function handleSubmit(event){
    event.preventDefault();
    const token = localStorage.getItem("token");
    if(!token){
      window.location.replace("/index.html");
      return;
    }

    const nickValue = els.nick?.value.trim();
    if(!nickValue){
      setMessage("El nick no puede estar vacío", "error");
      return;
    }

    const hasCurrent = Boolean(els.currentPassword?.value);
    const hasNew = Boolean(els.newPassword?.value);
    if(hasCurrent !== hasNew){
      setMessage("Para cambiar la contraseña completa ambos campos.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("nick", nickValue);
    if(hasCurrent){
      formData.append("currentPassword", els.currentPassword.value);
      formData.append("newPassword", els.newPassword.value);
    }
    if(els.avatarInput?.files?.[0]){
      formData.append("avatar", els.avatarInput.files[0]);
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
        localStorage.removeItem("user");
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
        currentUser = data.user;
        applyUser(data.user);
        shell?.setUser(data.user);
      }
      els.avatarInput.value = "";
      if(els.currentPassword) els.currentPassword.value = "";
      if(els.newPassword) els.newPassword.value = "";
      resetPreview();
      setMessage(data?.message || "Perfil actualizado correctamente", "success");
    }catch(error){
      console.error(error);
      setMessage("Ocurrió un error inesperado al guardar.", "error");
    }
  }

  function handleAvatarChange(){
    if(previewObjectUrl){
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
    const file = els.avatarInput?.files?.[0];
    if(!file){
      resetPreview();
      return;
    }
    previewObjectUrl = URL.createObjectURL(file);
    if(els.avatarPreview){
      els.avatarPreview.classList.remove("is-fallback");
      els.avatarPreview.src = previewObjectUrl;
    }
  }

  function initProfileEdit(appShell){
    shell = appShell;
    if(!shell) return;

    setRefs();

    shell.setActiveSidebar("profile");
    shell.setSearchVisibility(false);
    shell.setFabVisible(false);

    attachAvatarFallback(els.avatarPreview);

    shell.onUser(applyUser);
    const current = shell.getUser();
    if(current){
      applyUser(current);
    }
    shell.refreshUserFromApi();

    els.form?.addEventListener("submit", handleSubmit);
    els.avatarInput?.addEventListener("change", handleAvatarChange);
  }

  const startProfileEdit = (shellInstance) => {
    if(!shellInstance) return;
    document.removeEventListener("appshell:ready", onAppShellReady);
    initProfileEdit(shellInstance);
  };

  const onAppShellReady = (event) => startProfileEdit(event.detail);

  document.addEventListener("appshell:ready", onAppShellReady);

  if(window.appShell?.isReady){
    startProfileEdit(window.appShell);
  }
})();
