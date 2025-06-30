class CylinderClock {
  constructor(targetElement, options = {}) {
    if (!(targetElement instanceof HTMLElement)) {
      throw new Error(
        "Invalid targetElement provided. Must be an HTMLElement."
      );
    }
    this.targetElement = targetElement;
    this.options = options;
    this.worker = null;
    this.resizeObserver = null;

    (async () => {
      try {
        await this._init();
      } catch (error) {
        console.error("Error initializing CylinderClock:", error);
        this.destroy();
        if (error.message?.includes("Worker")) {
            this.targetElement.innerHTML =
                "<p style='color:red; text-align:center;'>Error: This browser does not support workers.</p>";
        } else {
            this.targetElement.innerHTML =
                "<p style='color:red; text-align:center;'>Error initializing clock.</p>";
        }
      }
    })();
  }

  async _init() {
    const canvasEl = document.createElement("canvas");
    this.targetElement.innerHTML = "";
    this.targetElement.appendChild(canvasEl);

    if (!window.Worker) {
        throw new Error("Worker not supported");
    }

    this.worker = new Worker(new URL("./CylinderClock.worker.js", import.meta.url), { type: "module" });

    const offscreen = canvasEl.transferControlToOffscreen();

    this.worker.postMessage({
        type: "init",
        payload: {
            canvas: offscreen,
            options: this.options,
            width: this.targetElement.clientWidth,
            height: this.targetElement.clientHeight,
            pixelRatio: window.devicePixelRatio
        }
    }, [offscreen]);

    this._onResize = this._onResize.bind(this);
    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(this.targetElement);
  }

  _onResize() {
    if (!this.worker) return;

    this.worker.postMessage({
        type: "resize",
        payload: {
            width: this.targetElement.clientWidth,
            height: this.targetElement.clientHeight,
            pixelRatio: window.devicePixelRatio
        }
    });
  }

  destroy() {
    if (this.resizeObserver && this.targetElement) {
      this.resizeObserver.unobserve(this.targetElement);
    }
    if (this.worker) {
      this.worker.postMessage({ type: "destroy" });
      this.worker = null;
    }
    if (this.targetElement) {
      this.targetElement.innerHTML = "";
    }
  }
}

export default CylinderClock;