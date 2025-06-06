import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";

class CylinderClock {
  constructor(targetElement, options = {}) {
    if (!(targetElement instanceof HTMLElement)) {
      throw new Error(
        "Invalid targetElement provided. Must be an HTMLElement."
      );
    }
    this.targetElement = targetElement;
    this.options = {
      language: "en-US",
      textColor: "#1C1C1C", // Dark graphite
      cylinderSurfaceColor: "#F5F5DC", // Ivory like
      redLineColor: "rgba(255, 0, 0, 0.7)",
      majorMarkColor: "#1C1C1C", // Dark graphite
      minorMarkColor: "#333333", // Slightly lighter graphite
      fontFamily: "Arial, sans-serif",
      textVerticalAlign: "middle",
      cylinderMinuteCount: 5,
      ...options,
    };

    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTimestamp = -1; // Last timestamp for animation loop

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cylinderMesh = null;

    try {
      //TODO: move: const fontLoader = new FontLoader();
      this._init();
    } catch (error) {
      console.error("Error initializing CylinderClock:", error);
      this.destroy(); // Clean up partially initialized resources
      if (error.message.includes("WebGLRenderer")) {
        // Basic WebGL check
        this.targetElement.innerHTML =
          "<p style='color:red; text-align:center;'>Error: WebGL is not supported or enabled in your browser.</p>";
      } else {
        this.targetElement.innerHTML =
          "<p style='color:red; text-align:center;'>Error initializing clock.</p>";
      }
    }
  }

  _init() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Scene
    this.scene = new THREE.Scene();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(
      this.targetElement.clientWidth,
      this.targetElement.clientHeight
    );
    this.targetElement.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      18,
      this.targetElement.clientWidth / this.targetElement.clientHeight,
      0.1,
      1000
    );
    // Position camera to view the cylinder. This will be adjusted in _handleResize.

    // Lighting
    // const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    // this.scene.add(ambientLight);
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    this.scene.add(hemisphereLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(50, 148, 7.5); // Experiment with position
    this.scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight2.position.set(-5, -10, 7.5); // Experiment with position
    this.scene.add(directionalLight2);

    //// Temp playground

    // Object
    const geometry = new THREE.CylinderGeometry(1, 1, 7, 50, 50, true);
    this._loadTextures((textures) => {
      this.textures = textures;

      const material = new THREE.MeshStandardMaterial({
        map: textures.textureColor,
        normalMap: textures.textureNormal,
        // How much the normal map affects the material. Typical ranges are 0-1. Default is a Vector2 set to (1,1).
        normalScale: new THREE.Vector2(1, 1),
        displacementMap: textures.textureHeight,
        displacementScale: 0.1, // How much the displacement map affects the mesh
        displacementBias: 0, // Added to the scaled sample of the displacement map
        roughnessMap: textures.textureRough,
        roughness: 0.35, // 0.0 means perfectly shiny, 0.0 means fully matt
        aoMap: textures.texture2AO,
        aoMapIntensity: 1, // Intensity of the ambient occlusion effect. Range is 0-1, where 0 disables ambient occlusion
        metalnessMap: textures.textureMetal,
        // How much the material is like a metal. Non-metallic materials such as wood or stone use 0.0, metallic use 1.0,
        // with nothing (usually) in between. Default is 0.0. A value between 0.0 and 1.0 could be used for a rusty metal
        // look. If metalnessMap is also provided, both values are multiplied.
        metalness: 0.0,
        color: 0xffffff, // Base color, texture will dominate
        side: THREE.FrontSide, // Render only front
      });

      this.mesh = new THREE.Mesh(geometry, material);

      this.mesh.geometry.attributes.uv2 = this.mesh.geometry.attributes.uv;
      this.mesh.position.set(0, 0, 0);

      this.mesh.rotation.z = Math.PI / 2;
      this.scene.add(this.mesh);

      this.camera.position.z = 9;

      // Start animation
      this._animationLoop = this._animationLoop.bind(this);
      this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
    });
  }

  _loadTextures(callback) {
    const folder = "Marble_Carrara_003_SD";
    const fileStem = "Marble_Carrara_003_";
    const texturePaths = {
      texture2AO: "OCC.jpg",
      textureMetal: null,
      textureRough: "ROUGH.jpg",
      textureNormal: "NORM.jpg",
      textureHeight: "DISP.png",
      textureColor: "COLOR.jpg",
    };

    const loader = new THREE.TextureLoader();
    // Create array of promises, each resolving to `[key, texture|null]`
    const promises = Object.entries(texturePaths).reduce((accum, currVal) => {
      accum.push(
        new Promise((resolve, reject) => {
          const [key, fileTail] = currVal;
          if (fileTail) {
            const path = `./assets/textures/${folder}/${fileStem}${fileTail}`;
            const onLoad = (tex) => {
              resolve([key, tex]);
            };
            const onErr = (err) => {
              reject("Failed to load " + path);
            };
            loader.load(path, onLoad, null, onErr);
          } else {
            resolve([key, null]);
          }
        })
      );
      return accum;
    }, []);

    Promise.all(promises).then((values) => {
      const textures = values.reduce((accum, currVal) => {
        const [key, texture] = currVal;
        accum[key] = texture;
        return accum;
      }, {});

      callback(textures);
    });
  }

  _animationLoop(timestamp) {
    if (!this.isRunning) return;

    const delta = timestamp - this.lastTimestamp;
    // Throttle animation loop to save CPU in case monitor refresh rate is too fast
    const maxRefreshRateHz = 30;
    if (delta < 1000 / maxRefreshRateHz) {
      this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
      return;
    }
    // // Show actual refresh rate in console
    // if (this.lastTimestamp !== -1) {
    //   const refreshRate = Math.round(1000 / delta);
    //   console.log(`Refresh rate: ${refreshRate} Hz`);
    // }
    this.lastTimestamp = timestamp;

    // this.mesh.rotation.z = Math.PI / 2;
    this.mesh.rotation.x = timestamp * -0.0001;

    this.renderer.render(this.scene, this.camera);

    if (this.isRunning) {
      this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
    }
  }

  destroy() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver && this.targetElement) {
      this.resizeObserver.unobserve(this.targetElement);
    }

    // Dispose Three.js objects
    if (this.scene) {
      // Traverse and dispose geometries, materials, textures
      this.scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => {
              if (material.map) material.map.dispose();
              material.dispose();
            });
          } else {
            if (object.material.map) object.material.map.dispose();
            object.material.dispose();
          }
        }
      });
      this.scene.clear(); // Recommended for removing all objects
    }

    if (this.texture) this.texture.dispose(); // CanvasTexture
    // Note: this.textureCanvas is a DOM element, not directly Three.js managed beyond CanvasTexture

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(
          this.renderer.domElement
        );
      }
    }

    this.targetElement.innerHTML = ""; // Clear the target div

    // Nullify references
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cylinderMesh = null;
    this.textureCanvas = null;
    this.texture = null;
    this.redIndexLines = [];
    this.options = null; // Allow options to be GC'd
    this.targetElement = null; // Allow targetElement to be GC'd if no other refs
  }
}

export default CylinderClock;
