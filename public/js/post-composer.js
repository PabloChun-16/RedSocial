(() => {
  const DEFAULT_ADJUSTMENTS = {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    warmth: 0,
    fade: 0
  };

  const FILTERS = [
    { id: "original", label: "Original", css: "" },
    { id: "aurora", label: "Aurora", css: "contrast(1.05) saturate(1.18)" },
    { id: "ember", label: "Ember", css: "brightness(1.05) saturate(1.2) sepia(0.15)" },
    { id: "midnight", label: "Nocturna", css: "brightness(0.92) contrast(1.12) saturate(0.9)" },
    { id: "solstice", label: "Solstice", css: "saturate(1.4) hue-rotate(12deg)" },
    { id: "lumen", label: "Lumen", css: "brightness(1.18) contrast(0.92)" }
  ];

  const TEMPLATE = `
    <div class="composer-modal" role="dialog" aria-modal="true" aria-label="Crear publicación">
      <div class="composer-preview">
        <img class="composer-preview__image composer-hidden" alt="Vista previa" />
        <div class="composer-preview__overlay"></div>
        <div class="composer-upload" data-dropzone>
          <div class="composer-upload__icon">📁</div>
          <div class="composer-upload__label">Arrastra tu foto aquí</div>
          <button type="button" class="composer-upload__button">Seleccionar desde la computadora</button>
          <input type="file" accept="image/*" />
        </div>
      </div>
      <div class="composer-panel">
        <header class="composer-head">
          <h2>Crear publicación</h2>
          <button type="button" class="composer-close" aria-label="Cerrar">×</button>
        </header>
        <div class="composer-error composer-hidden"></div>
        <section class="composer-step composer-step--edit is-active">
          <section class="composer-filters" aria-label="Filtros"></section>
          <section class="composer-sliders">
            ${[
              { id: "brightness", label: "Brillo", min: 0.5, max: 1.5, step: 0.01 },
              { id: "contrast", label: "Contraste", min: 0.5, max: 1.5, step: 0.01 },
              { id: "saturation", label: "Saturación", min: 0, max: 2, step: 0.01 },
              { id: "warmth", label: "Temperatura", min: -40, max: 40, step: 1 },
              { id: "fade", label: "Atenuar", min: 0, max: 1, step: 0.01 }
            ]
              .map(
                (slider) => `
                <div class="composer-slider">
                  <label for="composer-${slider.id}">${slider.label}</label>
                  <input type="range"
                    id="composer-${slider.id}"
                    name="${slider.id}"
                    min="${slider.min}"
                    max="${slider.max}"
                    step="${slider.step}"
                    value="${DEFAULT_ADJUSTMENTS[slider.id] ?? 0}" />
                </div>
              `
              )
              .join("")}
          </section>
          <section class="composer-story-tools composer-hidden" aria-label="Texto superpuesto">
            <div class="story-tools__head">
              <div>
                <h3>Texto superpuesto</h3>
                <p>Agrega mensajes y arrástralos por la imagen</p>
              </div>
              <button type="button" class="story-add-text">Agregar texto</button>
            </div>
            <div class="story-tools__editor">
              <label for="story-text-content">Contenido</label>
              <textarea id="story-text-content" placeholder="Describe tu momento..."></textarea>
              <div class="story-tools__row">
                <label class="story-tools__inline">
                  <span>Color</span>
                  <input type="color" id="story-text-color" value="#ffffff" />
                </label>
                <label class="story-tools__inline">
                  <span>Tamaño</span>
                  <input type="range" id="story-text-size" min="12" max="72" step="1" value="28" />
                </label>
                <label class="story-tools__inline">
                  <span>Posición X</span>
                  <input type="range" id="story-text-x" min="0" max="100" step="1" value="50" />
                </label>
                <label class="story-tools__inline">
                  <span>Posición Y</span>
                  <input type="range" id="story-text-y" min="0" max="100" step="1" value="50" />
                </label>
              </div>
              <div class="story-tools__footer">
                <button type="button" class="story-remove-text" disabled>Eliminar texto</button>
              </div>
            </div>
          </section>
          <div class="composer-actions composer-actions--story composer-hidden">
            <button type="button" class="btn-cancel">Cancelar</button>
            <button type="button" class="btn-story-submit">Publicar historia</button>
          </div>
          <div class="composer-actions composer-actions--simple">
            <button type="button" class="btn-cancel">Cancelar</button>
            <button type="button" class="btn-next">Siguiente</button>
          </div>
        </section>

        <section class="composer-step composer-step--details">
          <form class="composer-form">
            <textarea id="composer-caption" placeholder="Escribe una descripción..."></textarea>
            <div class="composer-tags">
              <label for="composer-tags-input">Etiquetas (separadas por comas)</label>
              <div class="composer-tags__row">
                <input id="composer-tags-input" type="text" placeholder="Ej: viaje, inspiración, arte" />
                <button type="button" class="composer-tags__suggest-btn" title="Sugerir etiquetas" aria-label="Sugerir etiquetas automáticas">
                  <span class="composer-tags__icon" aria-hidden="true">✨</span>
                </button>
              </div>
              <div class="composer-tags__suggestions composer-hidden">
                <span class="composer-tags__hint">Etiquetas sugeridas</span>
                <div class="composer-tags__chips"></div>
              </div>
            </div>
          </form>
          <div class="composer-actions">
            <select id="composer-visibility">
              <option value="public">Público</option>
              <option value="friends">Solo seguidores</option>
            </select>
            <div>
              <button type="button" class="btn-back">Atrás</button>
              <button type="button" class="btn-submit">Publicar</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  class PostComposer {
    constructor() {
      this.state = {
        file: null,
        previewUrl: "",
        filter: "original",
        adjustments: { ...DEFAULT_ADJUSTMENTS }
      };
      this.storyState = {
        texts: [],
        selectedId: null
      };
      this.aiState = {
        suggestions: [],
        fetched: false,
        pending: false
      };
      this.mode = "publication";
      this.listeners = new Set();
      this.token = () => localStorage.getItem("token");
      this.user = () => {
        try {
          return JSON.parse(localStorage.getItem("user"));
        } catch (err) {
          return null;
        }
      };
      this.hideTimeout = null;
      this.handleThemeChange = (event) => {
        this.applyTheme(event?.detail);
      };
      this.buildModal();
      this.registerGlobalTriggers();
      this.applyTheme(window.appShell?.getTheme?.());
      document.addEventListener("appshell:theme", this.handleThemeChange);
    }

    buildModal() {
      this.backdrop = document.createElement("div");
      this.backdrop.className = "composer-backdrop";
      this.backdrop.innerHTML = TEMPLATE;
      document.body.appendChild(this.backdrop);

      this.modal = this.backdrop.querySelector(".composer-modal");
      this.panel = this.backdrop.querySelector(".composer-panel");
      this.previewImg = this.backdrop.querySelector(".composer-preview__image");
      this.previewOverlay = this.backdrop.querySelector(".composer-preview__overlay");
      this.uploadArea = this.backdrop.querySelector(".composer-upload");
      this.fileInput = this.backdrop.querySelector('input[type="file"]');
      this.errorBox = this.backdrop.querySelector(".composer-error");
      this.filtersContainer = this.backdrop.querySelector(".composer-filters");
      this.sliders = Array.from(this.backdrop.querySelectorAll(".composer-slider input[type=\"range\"]"));
      this.storyTools = this.backdrop.querySelector(".composer-story-tools");
      this.storyAddBtn = this.backdrop.querySelector(".story-add-text");
      this.storyRemoveBtn = this.backdrop.querySelector(".story-remove-text");
      this.storyTextInput = this.backdrop.querySelector("#story-text-content");
      this.storyColorInput = this.backdrop.querySelector("#story-text-color");
      this.storySizeInput = this.backdrop.querySelector("#story-text-size");
      this.storyXInput = this.backdrop.querySelector("#story-text-x");
      this.storyYInput = this.backdrop.querySelector("#story-text-y");
      this.captionInput = this.backdrop.querySelector("#composer-caption");
      this.tagsInput = this.backdrop.querySelector("#composer-tags-input");
      this.suggestBtn = this.backdrop.querySelector(".composer-tags__suggest-btn");
      this.suggestBox = this.backdrop.querySelector(".composer-tags__suggestions");
      this.suggestChips = this.backdrop.querySelector(".composer-tags__chips");
      this.suggestHint = this.backdrop.querySelector(".composer-tags__hint");
      this.suggestIcon = this.backdrop.querySelector(".composer-tags__icon");
      this.visibilitySelect = this.backdrop.querySelector("#composer-visibility");
      this.closeBtn = this.backdrop.querySelector(".composer-close");
      this.cancelBtns = Array.from(this.backdrop.querySelectorAll(".btn-cancel"));
      this.storyActions = this.backdrop.querySelector(".composer-actions--story");
      this.nextBtn = this.backdrop.querySelector(".btn-next");
      this.backBtn = this.backdrop.querySelector(".btn-back");
      this.submitBtn = this.backdrop.querySelector(".btn-submit");
      this.storySubmitBtn = this.backdrop.querySelector(".btn-story-submit");
      this.uploadButton = this.backdrop.querySelector(".composer-upload__button");
      this.modalTitle = this.backdrop.querySelector(".composer-head h2");
      this.editStep = this.backdrop.querySelector(".composer-step--edit");
      this.detailsStep = this.backdrop.querySelector(".composer-step--details");
      this.simpleActions = this.backdrop.querySelector(".composer-actions--simple");
      this.backdrop.style.display = "none";

      this.renderFilters();
      this.attachEvents();
    }

    registerGlobalTriggers() {
      const handler = (event) => {
        const trigger = event.target.closest(".js-open-composer, [data-composer-mode]");
        if (!trigger) return;
        if (!trigger.classList.contains("js-open-composer") && !trigger.dataset.composerMode) {
          return;
        }
        event.preventDefault();
        const mode =
          trigger.dataset.composerMode ||
          trigger.dataset.mode ||
          trigger.getAttribute("data-mode") ||
          "publication";
        this.open(mode);
      };
      document.addEventListener("click", handler);
    }

    registerListener(fn) {
      if (typeof fn === "function") {
        this.listeners.add(fn);
      }
    }

    notify(publication) {
      this.listeners.forEach((fn) => {
        try {
          fn(publication);
        } catch (err) {
          console.warn("PostComposer listener error", err);
        }
      });
    }

    buildFilterCss(filterId, overrides = {}) {
      const adjustments = {
        ...DEFAULT_ADJUSTMENTS,
        ...(this.state.adjustments || {}),
        ...(overrides || {})
      };
      if (window.publicationViewer?.buildFilterCss) {
        return window.publicationViewer.buildFilterCss({
          filter: filterId,
          adjustments
        });
      }
      const filterDef = FILTERS.find((filter) => filter.id === filterId) || FILTERS[0];
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

    renderFilters() {
      this.filtersContainer.innerHTML = "";
      FILTERS.forEach((filter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `composer-filter${filter.id === this.state.filter ? " is-active" : ""}`;
        button.dataset.filter = filter.id;
        const filterCss = this.buildFilterCss(filter.id) || "none";
        button.innerHTML = `
          <div class="composer-filter__preview">
            <img src="${this.state.previewUrl || "/media/iconobase.png"}" alt="${filter.label}" style="filter:${filterCss};" />
          </div>
          <span>${filter.label}</span>
        `;
        button.addEventListener("click", () => {
          this.state.filter = filter.id;
          this.renderFilters();
          this.applyPreviewFilter();
        });
        this.filtersContainer.appendChild(button);
      });
    }

    escapeHtml(value) {
      if (value === null || value === undefined) return "";
      return value
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    resetSuggestions() {
      this.aiState = {
        suggestions: [],
        fetched: false,
        pending: false
      };
      this.renderSuggestedTags();
      this.updateSuggestButton();
    }

    renderSuggestedTags() {
      if (!this.suggestBox || !this.suggestChips) return;
      const suggestions = Array.isArray(this.aiState.suggestions)
        ? this.aiState.suggestions.filter(Boolean)
        : [];
      if (suggestions.length === 0) {
        if (this.aiState.fetched) {
          this.suggestBox.classList.remove("composer-hidden");
          this.suggestChips.innerHTML =
            '<span class="composer-tags__empty">No se encontraron sugerencias.</span>';
        } else {
          this.suggestBox.classList.add("composer-hidden");
          this.suggestChips.innerHTML = "";
        }
        return;
      }
      const active = new Set(
        this.parseInputTags().map((tag) => tag.toLowerCase())
      );
      const chips = suggestions
        .map((tag) => {
          const safe = this.escapeHtml(tag);
          const isActive = active.has(tag.toLowerCase());
          const classes = `composer-tag-chip${isActive ? " is-active" : ""}`;
          return `<button type="button" class="${classes}" data-tag="${safe}">#${safe}</button>`;
        })
        .join("");
      this.suggestChips.innerHTML = chips;
      this.suggestBox.classList.remove("composer-hidden");
    }

    updateSuggestButton() {
      if (!this.suggestBtn) return;
      const hasFile = Boolean(this.state.file);
      this.suggestBtn.disabled = !hasFile || this.aiState.pending;
      this.suggestBtn.classList.toggle("is-loading", this.aiState.pending);
      if (this.suggestIcon) {
        this.suggestIcon.textContent = this.aiState.pending ? "…" : "✨";
      }
    }

    parseInputTags() {
      if (!this.tagsInput) return [];
      return this.tagsInput.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    setInputTags(tags) {
      if (!this.tagsInput) return;
      const unique = [];
      tags.forEach((tag) => {
        const normalized = tag.trim();
        if (!normalized) return;
        if (!unique.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
          unique.push(normalized);
        }
      });
      this.tagsInput.value = unique.join(", ");
    }

    applySuggestedTag(tag) {
      if (typeof tag !== "string" || !tag.trim()) return;
      const list = this.parseInputTags();
      const normalized = tag.trim();
      if (!list.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        list.push(normalized);
        this.setInputTags(list);
      }
      this.renderSuggestedTags();
    }

    async requestSuggestions() {
      if (this.aiState.pending) return;
      if (!this.state.file) {
        this.showError("Selecciona una imagen para sugerir etiquetas.");
        return;
      }
      const token = this.token();
      if (!token) {
        window.location.replace("/index.html");
        return;
      }
      this.clearError();
      this.aiState.pending = true;
      this.updateSuggestButton();
      try {
        const formData = new FormData();
        formData.append("image", this.state.file);
        const response = await fetch("/api/ai/suggest-tags", {
          method: "POST",
          headers: { Authorization: token },
          body: formData
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            payload?.error ||
            payload?.message ||
            "No se pudieron obtener etiquetas sugeridas.";
          throw new Error(message);
        }
        const suggestions = Array.isArray(payload?.suggestions)
          ? payload.suggestions
              .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
              .filter(Boolean)
          : [];
        this.aiState.suggestions = Array.from(new Set(suggestions));
        this.aiState.fetched = true;
        this.renderSuggestedTags();
        if (!suggestions.length) {
          console.warn("[POST] No se recibieron sugerencias para la imagen.");
        }
      } catch (error) {
        console.error("[POST] ERROR al obtener etiquetas sugeridas:", error);
        this.showError(error.message || "No se pudieron obtener etiquetas sugeridas.");
      } finally {
        this.aiState.pending = false;
        this.updateSuggestButton();
      }
    }

    attachEvents() {
      this.closeBtn.addEventListener("click", () => this.close());
      this.cancelBtns.forEach((btn) => btn.addEventListener("click", () => this.close()));
      if (this.submitBtn) {
        this.submitBtn.addEventListener("click", () => this.handleSubmit());
      }
      if (this.storySubmitBtn) {
        this.storySubmitBtn.addEventListener("click", () => this.handleStorySubmit());
      }
      if(this.nextBtn) this.nextBtn.addEventListener("click", () => {
        if(!this.state.file){
          this.showError("Selecciona una imagen para continuar.");
          return;
        }
        this.goToStep("details");
      });
      if(this.backBtn) this.backBtn.addEventListener("click", () => this.goToStep("edit"));
      this.uploadButton.addEventListener("click", () => this.fileInput.click());
      this.fileInput.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (file) this.handleFile(file);
      });

      if (this.tagsInput) {
        this.tagsInput.addEventListener("input", () => this.renderSuggestedTags());
      }

      ["dragenter", "dragover"].forEach((eventName) => {
        this.uploadArea.addEventListener(eventName, (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.uploadArea.classList.add("is-dragover");
        });
      });
      ["dragleave", "drop"].forEach((eventName) => {
        this.uploadArea.addEventListener(eventName, (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.uploadArea.classList.remove("is-dragover");
        });
      });
      this.uploadArea.addEventListener("drop", (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file) this.handleFile(file);
      });

      if (this.suggestBtn) {
        this.suggestBtn.addEventListener("click", () => this.requestSuggestions());
      }
      if (this.suggestChips) {
        this.suggestChips.addEventListener("click", (event) => {
          const target = event.target.closest("[data-tag]");
          if (!target) return;
          event.preventDefault();
          this.applySuggestedTag(target.dataset.tag);
        });
      }

      this.sliders.forEach((slider) => {
        slider.addEventListener("input", () => {
          const key = slider.name;
          let value = Number.parseFloat(slider.value);
          if (Number.isNaN(value)) value = DEFAULT_ADJUSTMENTS[key] || 0;
          this.state.adjustments[key] = value;
          this.applyPreviewFilter();
          this.renderFilters();
        });
      });

      this.backdrop.addEventListener("click", (event) => {
        if (event.target === this.backdrop) {
          this.close();
        }
      });

      if (this.previewOverlay) {
        this.previewOverlay.addEventListener("pointerdown", (event) => {
          if (event.target === this.previewOverlay) {
            this.clearStorySelection();
          }
        });
      }

      if (this.storyAddBtn) {
        this.storyAddBtn.addEventListener("click", () => this.addStoryText());
      }
      if (this.storyRemoveBtn) {
        this.storyRemoveBtn.addEventListener("click", () => this.removeSelectedStoryText());
      }
      if (this.storyTextInput) {
        this.storyTextInput.addEventListener("input", () => {
          this.updateSelectedStoryText(
            { text: this.storyTextInput.value },
            { skipTextSync: true }
          );
        });
      }
      if (this.storyColorInput) {
        this.storyColorInput.addEventListener("input", () => {
          this.updateSelectedStoryText({ color: this.storyColorInput.value });
        });
      }
      if (this.storySizeInput) {
        this.storySizeInput.addEventListener("input", () => {
          const value = Number.parseInt(this.storySizeInput.value, 10);
          this.updateSelectedStoryText({ fontSize: value });
        });
      }
      if (this.storyXInput) {
        this.storyXInput.addEventListener("input", () => {
          const value = Number.parseFloat(this.storyXInput.value);
          this.updateSelectedStoryText({ x: Number.isFinite(value) ? value / 100 : 0.5 }, { skipTextSync: true });
        });
      }
      if (this.storyYInput) {
        this.storyYInput.addEventListener("input", () => {
          const value = Number.parseFloat(this.storyYInput.value);
          this.updateSelectedStoryText({ y: Number.isFinite(value) ? value / 100 : 0.5 }, { skipTextSync: true });
        });
      }

      this.renderSuggestedTags();
      this.updateSuggestButton();

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.backdrop.classList.contains("is-visible")) {
          this.close();
        }
      });
    }

    goToStep(step){
      if(this.mode === "story"){
        this.editStep?.classList.add("is-active");
        this.detailsStep?.classList.remove("is-active");
        if(this.panel){ this.panel.scrollTop = 0; }
        return;
      }
      const edit = this.backdrop.querySelector('.composer-step--edit');
      const details = this.backdrop.querySelector('.composer-step--details');
      if(step === 'details'){
        edit?.classList.remove('is-active');
        details?.classList.add('is-active');
      }else{
        details?.classList.remove('is-active');
        edit?.classList.add('is-active');
      }
      if(this.panel){ this.panel.scrollTop = 0; }
    }

    clearStorySelection() {
      if (this.storyState.selectedId == null) return;
      this.storyState.selectedId = null;
      this.updateStorySelection();
      this.syncStoryControls();
    }

    getSelectedStoryText() {
      if (!this.storyState.selectedId) return null;
      return this.storyState.texts.find((item) => item.id === this.storyState.selectedId) || null;
    }

    selectStoryText(id, options = {}) {
      if (this.mode !== "story") return;
      if (!id) {
        this.clearStorySelection();
        return;
      }
      if (this.storyState.selectedId !== id) {
        this.storyState.selectedId = id;
      }
      if (!options.skipRender) {
        this.updateStorySelection();
      }
      this.syncStoryControls();
    }

    updateStorySelection() {
      if (!this.previewOverlay) return;
      const children = this.previewOverlay.querySelectorAll(".story-overlay-text");
      children.forEach((node) => {
        const id = node.dataset.storyId;
        node.classList.toggle("is-selected", id === this.storyState.selectedId);
      });
    }

    addStoryText() {
      if (this.mode !== "story") return;
      if (!this.state.file) {
        this.showError("Selecciona una imagen antes de agregar texto.");
        return;
      }
      this.clearError();
      const id = `story-text-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const defaultColor = this.storyColorInput?.value?.trim?.() || "#ffffff";
      const entry = {
        id,
        text: "Tu texto aquí",
        color: defaultColor,
        fontSize: 28,
        x: 0.5,
        y: 0.5,
        rotation: 0,
        align: "center"
      };
      this.storyState.texts.push(entry);
      this.storyState.selectedId = id;
      this.renderStoryTexts();
      this.syncStoryControls();
    }

    removeSelectedStoryText() {
      if (this.mode !== "story") return;
      const selected = this.storyState.selectedId;
      if (!selected) return;
      const index = this.storyState.texts.findIndex((item) => item.id === selected);
      if (index === -1) return;
      this.storyState.texts.splice(index, 1);
      const fallback = this.storyState.texts[index] || this.storyState.texts[index - 1] || null;
      this.storyState.selectedId = fallback ? fallback.id : null;
      this.renderStoryTexts();
      this.syncStoryControls();
    }

    updateSelectedStoryText(patch = {}, options = {}) {
      if (this.mode !== "story") return;
      const target = this.getSelectedStoryText();
      if (!target) return;
      let changed = false;
      if (Object.prototype.hasOwnProperty.call(patch, "text") && typeof patch.text === "string" && patch.text !== target.text) {
        target.text = patch.text;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "color") && typeof patch.color === "string" && patch.color.trim()) {
        target.color = patch.color.trim();
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "fontSize")) {
        const size = Number.parseFloat(patch.fontSize);
        if (Number.isFinite(size) && size > 0) {
          target.fontSize = size;
          changed = true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, "x")) {
        const value = Number.parseFloat(patch.x);
        if (Number.isFinite(value)) {
          target.x = Math.min(1, Math.max(0, value));
          changed = true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, "y")) {
        const value = Number.parseFloat(patch.y);
        if (Number.isFinite(value)) {
          target.y = Math.min(1, Math.max(0, value));
          changed = true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, "rotation")) {
        const value = Number.parseFloat(patch.rotation);
        if (Number.isFinite(value)) {
          target.rotation = value;
          changed = true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, "align")) {
        const align = patch.align;
        if (align === "left" || align === "right" || align === "center") {
          target.align = align;
          changed = true;
        }
      }
      if (!changed) return;
      this.renderStoryTexts();
      this.syncStoryControls({ skipTextUpdate: Boolean(options.skipTextSync) });
    }

    renderStoryTexts() {
      if (!this.previewOverlay) return;
      const overlay = this.previewOverlay;
      const isStory = this.mode === "story";
      const hasFile = Boolean(this.state.file);
      overlay.innerHTML = "";
      if (!isStory || !hasFile) {
        overlay.classList.add("composer-hidden");
        if (!hasFile) {
          this.storyState.selectedId = null;
        }
        return;
      }
      overlay.classList.remove("composer-hidden");
      this.storyState.texts.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const node = document.createElement("div");
        node.className = `story-overlay-text${entry.id === this.storyState.selectedId ? " is-selected" : ""}`;
        node.dataset.storyId = entry.id;
        node.textContent = entry.text || "";
        node.style.color = entry.color || "#ffffff";
        node.style.fontSize = `${Number.isFinite(entry.fontSize) ? entry.fontSize : 24}px`;
        node.style.left = `${Math.min(100, Math.max(0, (entry.x ?? 0.5) * 100))}%`;
        node.style.top = `${Math.min(100, Math.max(0, (entry.y ?? 0.5) * 100))}%`;
        node.style.transform = `translate(-50%, -50%) rotate(${entry.rotation || 0}deg)`;
        node.style.textAlign = entry.align || "center";
        node.tabIndex = 0;
        node.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.selectStoryText(entry.id, { skipRender: true });
          this.startDragStoryText(event, entry.id);
        });
        node.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.selectStoryText(entry.id);
        });
        node.addEventListener("focus", () => this.selectStoryText(entry.id));
        overlay.appendChild(node);
      });
      this.updateStorySelection();
    }

    syncStoryControls(options = {}) {
      if (this.mode !== "story") return;
      const skipTextUpdate = Boolean(options.skipTextUpdate);
      const hasFile = Boolean(this.state.file);
      if (this.storyAddBtn) {
        this.storyAddBtn.disabled = !hasFile;
      }
      const selected = this.getSelectedStoryText();
      const hasSelection = Boolean(selected);
      const inputs = [
        this.storyTextInput,
        this.storyColorInput,
        this.storySizeInput,
        this.storyXInput,
        this.storyYInput
      ];
      inputs.forEach((input) => {
        if (!input) return;
        input.disabled = !hasSelection;
      });
      if (this.storyRemoveBtn) {
        this.storyRemoveBtn.disabled = !hasSelection;
      }
      if (!hasSelection) {
        if (this.storyTextInput && !skipTextUpdate) {
          if (document.activeElement !== this.storyTextInput) {
            this.storyTextInput.value = "";
          }
        }
        if (this.storyColorInput && !skipTextUpdate) {
          this.storyColorInput.value = "#ffffff";
        }
        if (this.storySizeInput) this.storySizeInput.value = 28;
        if (this.storyXInput) this.storyXInput.value = 50;
        if (this.storyYInput) this.storyYInput.value = 50;
        return;
      }
      if (this.storyColorInput && selected.color) {
        this.storyColorInput.value = selected.color;
      }
      if (this.storySizeInput && Number.isFinite(selected.fontSize)) {
        this.storySizeInput.value = Math.round(selected.fontSize);
      }
      if (this.storyXInput) {
        this.storyXInput.value = Math.round(selected.x * 100);
      }
      if (this.storyYInput) {
        this.storyYInput.value = Math.round(selected.y * 100);
      }
      if (this.storyTextInput && !skipTextUpdate) {
        if (document.activeElement !== this.storyTextInput) {
          this.storyTextInput.value = selected.text || "";
        }
      }
    }

    startDragStoryText(event, id) {
      if (this.mode !== "story" || !id || !this.previewOverlay) return;
      const text = this.storyState.texts.find((item) => item.id === id);
      if (!text) return;
      const element = event.currentTarget;
      const rect = this.previewOverlay.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const baseX = text.x ?? 0.5;
      const baseY = text.y ?? 0.5;
      const pointerId = event.pointerId;
      if (element.setPointerCapture) {
        try {
          element.setPointerCapture(pointerId);
        } catch (err) {
          // ignored
        }
      }
      const handleMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        const deltaX = (moveEvent.clientX - startX) / rect.width;
        const deltaY = (moveEvent.clientY - startY) / rect.height;
        const nextX = Math.min(1, Math.max(0, baseX + deltaX));
        const nextY = Math.min(1, Math.max(0, baseY + deltaY));
        text.x = nextX;
        text.y = nextY;
        element.style.left = `${nextX * 100}%`;
        element.style.top = `${nextY * 100}%`;
        if (this.storyXInput) this.storyXInput.value = Math.round(nextX * 100);
        if (this.storyYInput) this.storyYInput.value = Math.round(nextY * 100);
      };
      const handleUp = (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        if (element.releasePointerCapture) {
          try {
            element.releasePointerCapture(pointerId);
          } catch (err) {
            // ignored
          }
        }
        this.syncStoryControls({ skipTextUpdate: true });
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    }

    setMode(mode) {
      const normalized = mode === "story" ? "story" : "publication";
      this.mode = normalized;
      this.updateModeUi();
    }

    updateModeUi() {
      const isStory = this.mode === "story";
      if (this.modal) {
        this.modal.dataset.mode = this.mode;
        this.modal.setAttribute("aria-label", isStory ? "Crear historia" : "Crear publicación");
      }
      if (this.modalTitle) {
        this.modalTitle.textContent = isStory ? "Crear historia" : "Crear publicación";
      }
      if (this.storyTools) {
        this.storyTools.classList.toggle("composer-hidden", !isStory);
      }
      if (this.storyActions) {
        this.storyActions.classList.toggle("composer-hidden", !isStory);
      }
      if (this.simpleActions) {
        this.simpleActions.classList.toggle("composer-hidden", isStory);
      }
      if (this.detailsStep) {
        this.detailsStep.classList.toggle("composer-hidden", isStory);
        if (isStory) {
          this.detailsStep.classList.remove("is-active");
        }
      }
      if (this.nextBtn) {
        this.nextBtn.hidden = isStory;
        this.nextBtn.disabled = isStory;
      }
      if (this.backBtn) {
        this.backBtn.hidden = isStory;
        this.backBtn.disabled = isStory;
      }
      if (this.visibilitySelect) {
        this.visibilitySelect.hidden = isStory;
      }
      if (this.previewImg) {
        this.previewImg.classList.toggle("composer-preview__image--story", isStory);
      }
      if (this.previewOverlay) {
        if (!isStory) {
          this.previewOverlay.classList.add("composer-hidden");
        } else if (this.state.file) {
          this.previewOverlay.classList.remove("composer-hidden");
        }
      }
      if (this.backdrop) {
        this.backdrop.classList.toggle("composer-is-story", isStory);
      }
      if (isStory) {
        this.goToStep("edit");
      }
      this.renderStoryTexts();
      this.syncStoryControls();
    }

    handleFile(file) {
      if (!file.type.startsWith("image/")) {
        this.showError("El archivo debe ser una imagen.");
        return;
      }
      this.clearError();
      this.state.file = file;
      if (this.state.previewUrl) URL.revokeObjectURL(this.state.previewUrl);
      this.state.previewUrl = URL.createObjectURL(file);
      this.previewImg.src = this.state.previewUrl;
      this.previewImg.classList.remove("composer-hidden");
      this.uploadArea.classList.add("composer-hidden");
      if (this.previewOverlay && this.mode === "story") {
        this.previewOverlay.classList.remove("composer-hidden");
      }
      this.resetSuggestions();
      // Actualiza la imagen en las miniaturas de filtros y aplica el filtro al preview
      this.renderFilters();
      this.applyPreviewFilter();
      if (this.mode === "story") {
        this.renderStoryTexts();
        this.syncStoryControls();
      }
    }

    applyPreviewFilter() {
      if (!this.previewImg) return;
      this.previewImg.style.filter = this.buildFilterCss(this.state.filter) || "none";
    }

    reset() {
      this.state = {
        file: null,
        previewUrl: "",
        filter: "original",
        adjustments: { ...DEFAULT_ADJUSTMENTS }
      };
      this.storyState = {
        texts: [],
        selectedId: null
      };
      if (this.fileInput) this.fileInput.value = "";
      if (this.previewImg) {
        this.previewImg.src = "";
        this.previewImg.classList.add("composer-hidden");
      }
      if (this.previewOverlay) {
        this.previewOverlay.innerHTML = "";
        this.previewOverlay.classList.add("composer-hidden");
      }
      if (this.uploadArea) {
        this.uploadArea.classList.remove("composer-hidden");
      }
      if (this.captionInput) this.captionInput.value = "";
      if (this.tagsInput) this.tagsInput.value = "";
      if (this.visibilitySelect) this.visibilitySelect.value = "public";
      this.sliders.forEach((slider) => {
        const key = slider.name;
        slider.value = DEFAULT_ADJUSTMENTS[key] ?? 0;
      });
      this.resetSuggestions();
      this.renderFilters();
      this.applyPreviewFilter();
      this.clearError();
      this.renderStoryTexts();
      this.syncStoryControls();
      this.goToStep('edit');
      this.updateModeUi();
    }

    open(mode = "publication") {
      const token = this.token();
      const user = this.user();
      if(!token || !user){
        window.location.replace("/index.html");
        return;
      }
      this.mode = mode === "story" ? "story" : "publication";
      this.applyTheme(window.appShell?.getTheme?.());
      this.reset();
      if(this.panel){
        this.panel.scrollTop = 0;
      }
      this.backdrop.style.display = "flex";
      requestAnimationFrame(() => {
        this.backdrop.classList.add("is-visible");
      });
    }

  close() {
    this.backdrop.classList.remove("is-visible");
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if(!this.backdrop.classList.contains("is-visible")){
        this.backdrop.style.display = "none";
      }
    }, 320);
    if (this.state.previewUrl) {
      URL.revokeObjectURL(this.state.previewUrl);
    }
  }

    showError(message) {
      this.errorBox.textContent = message;
      this.errorBox.classList.remove("composer-hidden");
    }

    clearError() {
      this.errorBox.textContent = "";
      this.errorBox.classList.add("composer-hidden");
    }

    applyTheme(mode) {
      if(!this.backdrop) return;
      const inferred =
        mode ||
        window.appShell?.getTheme?.() ||
        (document.body.classList.contains("theme-day") ? "day" : "night");
      const isDay = inferred === "day";
      this.backdrop.classList.toggle("is-day", isDay);
      if(this.modal){
        this.modal.classList.toggle("is-day", isDay);
      }
    }

    getStoryTextBlocksPayload() {
      if (!Array.isArray(this.storyState.texts)) return [];
      return this.storyState.texts
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const text = typeof entry.text === "string" ? entry.text.trim() : "";
          if (!text) return null;
          const payload = {
            id: entry.id,
            text,
            color: entry.color || "#ffffff",
            fontSize: Number.isFinite(entry.fontSize) ? entry.fontSize : 24,
            x: Number.isFinite(entry.x) ? Number(entry.x.toFixed(4)) : 0.5,
            y: Number.isFinite(entry.y) ? Number(entry.y.toFixed(4)) : 0.5,
            rotation: Number.isFinite(entry.rotation) ? entry.rotation : 0,
            align: entry.align === "left" || entry.align === "right" ? entry.align : "center"
          };
          return payload;
        })
        .filter(Boolean);
    }

    async handleStorySubmit() {
      if (this.mode !== "story") return;
      if (!this.state.file) {
        this.showError("Selecciona una imagen para continuar.");
        return;
      }
      const token = this.token();
      if (!token) {
        window.location.replace("/index.html");
        return;
      }
      this.clearError();
      if (this.storySubmitBtn) {
        this.storySubmitBtn.disabled = true;
        this.storySubmitBtn.textContent = "Publicando...";
      }
      try {
        const formData = new FormData();
        formData.append("media", this.state.file);
        formData.append("filter", this.state.filter);
        formData.append("adjustments", JSON.stringify(this.state.adjustments));
        formData.append("textBlocks", JSON.stringify(this.getStoryTextBlocksPayload()));

        const response = await fetch("/api/stories", {
          method: "POST",
          headers: { Authorization: token },
          body: formData
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload?.message || "No se pudo publicar la historia";
          throw new Error(message);
        }

        this.close();
        if (payload?.story) {
          document.dispatchEvent(
            new CustomEvent("story:created", {
              detail: { story: payload.story }
            })
          );
        }
      } catch (error) {
        console.error(error);
        this.showError(error.message || "Ocurrió un error inesperado al publicar la historia.");
      } finally {
        if (this.storySubmitBtn) {
          this.storySubmitBtn.disabled = false;
          this.storySubmitBtn.textContent = "Publicar historia";
        }
      }
    }

    async handleSubmit() {
      if (!this.state.file) {
        this.showError("Selecciona una imagen para continuar.");
        return;
      }
      const token = this.token();
      if (!token) {
        window.location.replace("/index.html");
        return;
      }
      this.clearError();
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = "Publicando...";

      try {
        const formData = new FormData();
        formData.append("media", this.state.file);
        formData.append("caption", this.captionInput.value.trim());
        formData.append("tags", this.tagsInput.value.trim());
        formData.append("filter", this.state.filter);
        formData.append("adjustments", JSON.stringify(this.state.adjustments));
        formData.append("visibility", this.visibilitySelect.value);
        if (Array.isArray(this.aiState.suggestions) && this.aiState.suggestions.length) {
          formData.append("autoTags", JSON.stringify(this.aiState.suggestions));
        }

        const response = await fetch("/api/publication", {
          method: "POST",
          headers: { Authorization: token },
          body: formData
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload?.message || "No se pudo crear la publicación";
          throw new Error(message);
        }

        this.close();
        if (payload?.publication) {
          this.notify(payload.publication);
        }
      } catch (error) {
        console.error(error);
        this.showError(error.message || "Ocurrió un error inesperado al publicar.");
      } finally {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = "Publicar";
      }
    }
  }

  window.postComposer = new PostComposer();
})();
