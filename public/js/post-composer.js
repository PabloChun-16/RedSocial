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
              <input id="composer-tags-input" type="text" placeholder="Ej: viaje, inspiración, arte" />
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
    this.buildModal();
    this.registerGlobalTriggers();
  }

    buildModal() {
      this.backdrop = document.createElement("div");
      this.backdrop.className = "composer-backdrop";
      this.backdrop.innerHTML = TEMPLATE;
      document.body.appendChild(this.backdrop);

      this.modal = this.backdrop.querySelector(".composer-modal");
      this.panel = this.backdrop.querySelector(".composer-panel");
      this.previewImg = this.backdrop.querySelector(".composer-preview__image");
      this.uploadArea = this.backdrop.querySelector(".composer-upload");
      this.fileInput = this.backdrop.querySelector('input[type="file"]');
      this.errorBox = this.backdrop.querySelector(".composer-error");
      this.filtersContainer = this.backdrop.querySelector(".composer-filters");
      this.sliders = Array.from(this.backdrop.querySelectorAll(".composer-slider input[type=\"range\"]"));
      this.captionInput = this.backdrop.querySelector("#composer-caption");
      this.tagsInput = this.backdrop.querySelector("#composer-tags-input");
      this.visibilitySelect = this.backdrop.querySelector("#composer-visibility");
      this.closeBtn = this.backdrop.querySelector(".composer-close");
      this.cancelBtns = Array.from(this.backdrop.querySelectorAll(".btn-cancel"));
      this.nextBtn = this.backdrop.querySelector(".btn-next");
      this.backBtn = this.backdrop.querySelector(".btn-back");
      this.submitBtn = this.backdrop.querySelector(".btn-submit");
      this.uploadButton = this.backdrop.querySelector(".composer-upload__button");
      this.backdrop.style.display = "none";

      this.renderFilters();
      this.attachEvents();
    }

  registerGlobalTriggers() {
    const handler = (event) => {
      const trigger = event.target.closest(".js-open-composer");
      if (!trigger) return;
      event.preventDefault();
      this.open();
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

    renderFilters() {
      this.filtersContainer.innerHTML = "";
      FILTERS.forEach((filter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `composer-filter${filter.id === this.state.filter ? " is-active" : ""}`;
        button.dataset.filter = filter.id;
        button.innerHTML = `
          <div class="composer-filter__preview">
            <img src="${this.state.previewUrl || "/media/iconobase.png"}" alt="${filter.label}" style="filter:${filter.css};" />
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

    attachEvents() {
      this.closeBtn.addEventListener("click", () => this.close());
      this.cancelBtns.forEach((btn) => btn.addEventListener("click", () => this.close()));
      this.submitBtn.addEventListener("click", () => this.handleSubmit());
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

      this.sliders.forEach((slider) => {
        slider.addEventListener("input", () => {
          const key = slider.name;
          let value = Number.parseFloat(slider.value);
          if (Number.isNaN(value)) value = DEFAULT_ADJUSTMENTS[key] || 0;
          this.state.adjustments[key] = value;
          this.applyPreviewFilter();
        });
      });

      this.backdrop.addEventListener("click", (event) => {
        if (event.target === this.backdrop) {
          this.close();
        }
      });

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.backdrop.classList.contains("is-visible")) {
          this.close();
        }
      });
    }

    goToStep(step){
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
      // Actualiza la imagen en las miniaturas de filtros y aplica el filtro al preview
      this.renderFilters();
      this.applyPreviewFilter();
    }

    applyPreviewFilter() {
      if (!this.previewImg) return;
      const filterDef = FILTERS.find((f) => f.id === this.state.filter) || FILTERS[0];
      const { brightness, contrast, saturation, warmth, fade } = this.state.adjustments;
      const warmthDeg = warmth;
      const fadeFactor = 1 - Math.min(Math.max(fade, 0), 1) * 0.15;
      const filterParts = [
        `brightness(${brightness})`,
        `contrast(${contrast})`,
        `saturate(${saturation})`,
        warmth !== 0 ? `hue-rotate(${warmthDeg}deg)` : "",
        fade !== 0 ? `brightness(${fadeFactor})` : "",
        filterDef.css
      ].filter(Boolean);
      this.previewImg.style.filter = filterParts.join(" ");
    }

    reset() {
      this.state = {
        file: null,
        previewUrl: "",
        filter: "original",
        adjustments: { ...DEFAULT_ADJUSTMENTS }
      };
      this.fileInput.value = "";
      this.previewImg.src = "";
      this.previewImg.classList.add("composer-hidden");
      this.uploadArea.classList.remove("composer-hidden");
      this.captionInput.value = "";
      this.tagsInput.value = "";
      this.visibilitySelect.value = "public";
      this.sliders.forEach((slider) => {
        const key = slider.name;
        slider.value = DEFAULT_ADJUSTMENTS[key] ?? 0;
      });
      this.renderFilters();
      this.applyPreviewFilter();
      this.clearError();
      this.goToStep('edit');
    }

    open() {
      const token = this.token();
      const user = this.user();
      if (!token || !user) {
        window.location.replace("/index.html");
        return;
      }
    this.reset();
    if(this.panel){ this.panel.scrollTop = 0; }
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
