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

    (async () => {
      try {
        await this._init();
      } catch (error) {
        console.error("Error initializing CylinderClock:", error);
        this.destroy(); // Clean up partially initialized resources
        if (error.message?.includes("WebGLRenderer")) {
          // Basic WebGL check
          this.targetElement.innerHTML =
            "<p style='color:red; text-align:center;'>Error: WebGL is not supported or enabled in your browser.</p>";
        } else {
          this.targetElement.innerHTML =
            "<p style='color:red; text-align:center;'>Error initializing clock.</p>";
        }
      }
    })();
  }

  async _init() {
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
    const aspect =
      this.targetElement.clientWidth / this.targetElement.clientHeight;
    this.camera = new THREE.PerspectiveCamera(25, aspect, 0.1, 1000);
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

    // Choose between LatheGeometry (which supports bevels) and CylinderGeometry (which doesn't).
    // Texture repeat is different for each.
    this.cylinderType = "cylinder"; // 'lathe' or 'cylinder'
    this.cylinderTextureRepeat =
      this.cylinderType === "lathe" ? [2, 4] : [1, 1];

    // Cylinder textures
    this.textures = await this._loadTextures();

    // Initial resize and positioning
    this._handleResize(true);

    // Start animation
    this._animationLoop = this._animationLoop.bind(this);
    this.animationFrameId = window.requestAnimationFrame(this._animationLoop);

    // Setup responsiveness
    this.resizeObserver = new ResizeObserver(() => this._handleResize());
    this.resizeObserver.observe(this.targetElement);
  }

  /**
   * Loads textures for cylinder.
   * @returns Promise that resolves to a map of textures keyed by texture name.
   */
  async _loadTextures() {
    const folder = "Marble_Carrara_003_SD";
    const fileStem = "Marble_Carrara_003_";
    const fileTails = {
      texture2AO: "OCC.jpg",
      textureMetal: null,
      textureRough: "ROUGH.jpg",
      textureNormal: "NORM.jpg",
      textureHeight: "DISP.png",
      textureColor: "COLOR.jpg",
    };

    const loader = new THREE.TextureLoader();
    // Create array of promises, each resolving to `[key, texture|null]`
    const promises = Object.entries(fileTails).reduce((accum, currVal) => {
      accum.push(
        new Promise((resolve, reject) => {
          const [key, fileTail] = currVal;
          if (fileTail) {
            const path = `./assets/textures/${folder}/${fileStem}${fileTail}`;
            const onLoad = (tex) => {
              tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
              tex.repeat.set(...this.cylinderTextureRepeat);
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

    return Promise.all(promises).then((values) => {
      return values.reduce((accum, currVal) => {
        const [key, texture] = currVal;
        accum[key] = texture;
        return accum;
      }, {});
    });
  }

  _createCylinder() {
    const textures = this.textures;
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
      //wireframe: true,
    });

    const divHeight = this.targetElement.clientHeight;
    const cylinderRadius = divHeight / 2.5; // Make cylinder diameter a bit smaller than div height
    const cylinderLength = cylinderRadius * 2 * 3; // L = 3 * D

    console.log(9, cylinderRadius, cylinderLength);
    const geometry =
      this.cylinderType === "lathe"
        ? this._createBevelledCylinderGeometry()
        : new THREE.CylinderGeometry(
            cylinderRadius,
            cylinderRadius,
            cylinderLength,
            50,
            1,
            true
          );

    const mesh = (this.cylinderMesh = new THREE.Mesh(geometry, material));

    // Ambient occlusion maps (aoMap) use a second set of UV coordinates, stored in geometry.attributes.uv2.
    // However, most geometries (like THREE.CylinderGeometry) only generate one UV set by default (geometry.attributes.uv),
    // which is used for color textures, normal maps, etc. So this line copies the existing UV set to uv2, allowing the AO
    // map to be applied using the same UVs. Without this, the ambient occlusion texture won’t be displayed at all.
    mesh.geometry.attributes.uv2 = mesh.geometry.attributes.uv;

    mesh.position.set(0, 0, 0);

    this.cylinderMesh.rotation.z = Math.PI / 2;
    this.scene.add(mesh);
  }

  _createBevelledCylinderGeometry() {
    // Define the 2D profile for the lathe (X = radius, Y = height)
    const points = [];

    // Bottom center
    //points.push(new THREE.Vector2(0, -3.5));

    // Bottom bevel (small outward slope)
    points.push(new THREE.Vector2(0.98, -3.48));
    points.push(new THREE.Vector2(1.0, -3.46));

    // Straight side
    points.push(new THREE.Vector2(1.0, 3.46));

    // Top bevel (inward slope)
    points.push(new THREE.Vector2(0.98, 3.48));
    //points.push(new THREE.Vector2(0, 3.5));

    // Create LatheGeometry by rotating the profile around the Y-axis
    const geometry = new THREE.LatheGeometry(points, 50);
    return geometry;
  }

  _handleResize(force) {
    const camera = this.camera;
    if (!this.renderer || !camera || !this.targetElement) {
      console.log(
        "_handleResize() returning early",
        !!this.renderer,
        !!camera,
        !!this.targetElement
      );
      return;
    }

    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (force || needResize) {
      console.log("Resize needed", canvas.width, width, canvas.height, height);

      this.renderer.setSize(width, height, false);

      this.scene.remove(this.cylinderMesh);
      if (this.cylinderMesh) {
        this.cylinderMesh.geometry.dispose();
        this.cylinderMesh.material.dispose(); // Texture is shared, don't dispose.
      }
      this._createCylinder(); // Will use current targetElement dimensions
      // this._createRedIndexLines(); // Re-create red lines based on new cylinder size

      // Adjust camera position to frame the (potentially new sized) cylinder
      // Fit cylinder (length `actualCylinderLength`, diameter `2 * actualCylinderRadius`)
      const actualCylinderRadius =
        this.cylinderMesh.geometry.parameters.radiusTop;
      const actualCylinderLength = this.cylinderMesh.geometry.parameters.height;

      const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
      console.log(4, fovRad);
      const distToFitHeight = actualCylinderRadius / Math.tan(fovRad / 2);
      const distToFitWidth =
        actualCylinderLength / 2 / (Math.tan(fovRad / 2) * this.camera.aspect);

      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.position.x = 0;
      camera.position.y = 0;
      this.camera.position.z =
        Math.max(distToFitHeight, distToFitWidth) * 1.1 + actualCylinderRadius; // 1.1 for padding
      console.log(5, this.camera.position.z);
      // this.camera.position.z = 1000;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    // const width = this.targetElement.clientWidth;
    // const height = this.targetElement.clientHeight;
    // console.log(1, this.targetElement, width, height);

    // this.renderer.setSize(width, height);
    // camera.aspect = width / height;

    //------------------

    // // Adjust cylinder geometry or camera to fit
    // // Keep cylinder L = 3 * D. D is 2 * radius.
    // let cylinderRadius, cylinderLength;

    // // Option: Scale cylinder to fit div
    // const typicalAspectRatio = 3 / 1; // Cylinder L/D
    // const divAspect = width / height;

    // if (divAspect > typicalAspectRatio) {
    //   // Div is wider than typical cylinder aspect
    //   // Fit to height
    //   cylinderRadius = height / 2.5;
    // } else {
    //   // Div is taller or equal aspect
    //   // Fit to width (L = width)
    //   cylinderRadius = width / typicalAspectRatio / 2.5;
    // }
    // cylinderLength = typicalAspectRatio * (cylinderRadius * 2);

    // // Update cylinder geometry (if needed, or scale mesh)
    // // For simplicity, let's assume the initial geometry is okay and we adjust camera
    // // Or, rebuild geometry (more complex to do on each resize for existing texture mapping)
    // // Scaling the mesh is easier:
    // if (
    //   this.cylinderMesh.geometry.parameters.radiusTop !== cylinderRadius ||
    //   this.cylinderMesh.geometry.parameters.height !== cylinderLength
    // ) {
    //   console.log("Updating cylinder geometry");
    //   console.log(
    //     0,
    //     this.cylinderMesh.geometry.parameters.radiusTop,
    //     cylinderRadius,
    //     this.cylinderMesh.geometry.parameters.height,
    //     cylinderLength
    //   );
    //   // Recreate geometry (this might be heavy) or scale the mesh
    //   // Simple scaling for now:
    //   const oldRadius = this.cylinderMesh.geometry.parameters.radiusTop;
    //   //const oldLength = this.cylinderMesh.geometry.parameters.height;
    //   //this.cylinderMesh.scale.set(cylinderLength/oldLength, cylinderRadius/oldRadius, cylinderRadius/oldRadius);
    //   // Re-creating is safer for UVs and complex interactions
    //   this.scene.remove(this.cylinderMesh);
    //   this.cylinderMesh.geometry.dispose();
    //   this.cylinderMesh.material.dispose(); // Texture is shared, don't dispose.
    //   this._createCylinder(); // Will use current targetElement dimensions
    //   // this._createRedIndexLines(); // Re-create red lines based on new cylinder size
    // }

    // // Adjust camera position to frame the (potentially new sized) cylinder
    // // Fit cylinder (length `actualCylinderLength`, diameter `2 * actualCylinderRadius`)
    // const actualCylinderRadius =
    //   this.cylinderMesh.geometry.parameters.radiusTop;
    // const actualCylinderLength = this.cylinderMesh.geometry.parameters.height;

    // console.log(1, actualCylinderRadius, actualCylinderLength);

    // const fovRad = THREE.MathUtils.degToRad(camera.fov);
    // const distToFitHeight = actualCylinderRadius / Math.tan(fovRad / 2);
    // const distToFitWidth =
    //   actualCylinderLength / 2 / (Math.tan(fovRad / 2) * camera.aspect);

    // camera.position.x = 0;
    // camera.position.y = 0;
    // camera.position.z =
    //   Math.max(distToFitHeight, distToFitWidth) * 1.1 + actualCylinderRadius; // 1.1 for padding
    // camera.lookAt(0, 0, 0);
    // camera.updateProjectionMatrix();
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

    // this.cylinderMesh.rotation.z = Math.PI / 2;
    this.cylinderMesh.rotation.x = timestamp * -0.0001;

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

    // Note: this.textureCanvas is a DOM element, not directly Three.js managed beyond CanvasTexture
    for (const [key, tex] of Object.entries(this.textures || {}))
      if (tex) tex.dispose();

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
    this.textures = null;
    this.redIndexLines = [];
    this.options = null; // Allow options to be GC'd
  }
}

export default CylinderClock;
