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

    this.cylDiameter = 5;
    this.cylAxialLength = 15;
    // We don't want the cylinder rendered right up against the canvas edges
    this.sceneHeight = this.cylDiameter + 0.5;
    this.sceneWidth = this.cylAxialLength + 2.0;

    this.markerRadialHeight = 0.08; // Thickness of the marker (embossed'ness)

    this.minorMarkerCircumferentialLength = 0.06;
    this.minorMarkerAxialWidth = 0.5; // Width along the cylinder's length

    this.majorMarkerCircumferentialLength = 0.18;
    this.majorMarkerAxialWidth = this.minorMarkerAxialWidth * 1.4;

    this.markerEndBuffer =
      Math.max(this.majorMarkerAxialWidth, this.minorMarkerAxialWidth) / 2 +
      0.02;

    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTimestamp = -1; // Last timestamp for animation loop
    this.maxRateHz = 30;
    this.lastRateHz = this.maxRateHz;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cylinderGroup = null;

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

    // ## Camera Setup ##
    // The initial camera setup. The aspect ratio and fov will be adjusted
    // dynamically by the ResizeObserver.
    const aspect =
      this.targetElement.clientWidth / this.targetElement.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    // The generated cylinder is quite large, so we need to move the camera
    // back to be able to see it.
    this.camera.position.z = 30;

    // ## Renderer Setup ##
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    // renderer size set in onResize
    this.targetElement.appendChild(this.renderer.domElement);

    // ## Lighting ##
    // const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    // this.scene.add(ambientLight);
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    this.scene.add(hemisphereLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 148, 7.5); // Experiment with position
    this.scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.6);
    directionalLight2.position.set(-5, -10, 7.5); // Experiment with position
    this.scene.add(directionalLight2);

    // ## Cylinder Creation ##
    this.cylinderGroup = new THREE.Group();
    this.scene.add(this.cylinderGroup);
    await this._createCylinder();
    this._createMarkers();

    // ## Responsive Resizing ##
    this._onResize = this._onResize.bind(this);
    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(this.targetElement);

    // Initial resize call to set everything up.
    this._onResize();

    // Start animation
    this._animationLoop = this._animationLoop.bind(this);
    this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
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
              tex.repeat.set(2, 2);
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

  async _createCylinder() {
    const points = this._generateBevelledCylinderPoints({
      radius: this.cylDiameter / 2,
      height: this.cylAxialLength,
      bevelSize: 0.04,
      bevelSegments: 2, // Use more segments for a smoother bevel
    });
    const geometry = new THREE.LatheGeometry(points, 64);
    const textures = (this.textures = await this._loadTextures());
    const material = new THREE.MeshStandardMaterial({
      map: textures.textureColor,
      normalMap: textures.textureNormal,
      // How much the normal map affects the material. Typical ranges are 0-1. Default is a Vector2 set to (1,1).
      normalScale: new THREE.Vector2(2, 2),
      displacementMap: textures.textureHeight,
      displacementScale: 0.1, // How much the displacement map affects the mesh
      displacementBias: 0, // Added to the scaled sample of the displacement map
      roughnessMap: textures.textureRough,
      roughness: 0.25, // 0.0 means perfectly shiny, 1.0 means fully matt
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
    const mesh = new THREE.Mesh(geometry, material);

    // Ambient occlusion maps (aoMap) use a second set of UV coordinates, stored in geometry.attributes.uv2.
    // However, most geometries (like THREE.CylinderGeometry) only generate one UV set by default (geometry.attributes.uv),
    // which is used for color textures, normal maps, etc. So this line copies the existing UV set to uv2, allowing the AO
    // map to be applied using the same UVs. Without this, the ambient occlusion texture won’t be displayed at all.
    mesh.geometry.attributes.uv2 = mesh.geometry.attributes.uv;

    // Orient the cylinder horizontally
    mesh.rotation.z = Math.PI / 2;
    this.cylinderGroup.add(mesh);
  }

  _createMarkers() {
    const numMajorMarkers = 5;
    const numMinorMarkersBetweenMajor = 11;
    const totalMarkersPerEnd =
      numMajorMarkers * (1 + numMinorMarkersBetweenMajor);
    const baseAngleIncrement = (2 * Math.PI) / totalMarkersPerEnd;

    const cylinderMarkerPlacementX =
      this.cylAxialLength / 2 - this.markerEndBuffer;
    const markerXPositions = [
      -cylinderMarkerPlacementX,
      cylinderMarkerPlacementX,
    ];

    markerXPositions.forEach((markerCenterX) => {
      for (let i = 0; i < totalMarkersPerEnd; i++) {
        const isMajor = i % (numMinorMarkersBetweenMajor + 1) === 0;

        const axialWidth = isMajor
          ? this.majorMarkerAxialWidth
          : this.minorMarkerAxialWidth;
        const radialHeight = isMajor
          ? this.markerRadialHeight
          : this.markerRadialHeight / 4;
        const circumferentialLength = isMajor
          ? this.majorMarkerCircumferentialLength
          : this.minorMarkerCircumferentialLength;

        const markerCenterAngle = i * baseAngleIncrement;

        const markerGeom = this._createDeformedMarkerGeometry(
          axialWidth,
          radialHeight,
          circumferentialLength,
          this.cylDiameter / 2,
          markerCenterX,
          markerCenterAngle
        );
        const markerMaterial = new THREE.MeshStandardMaterial({
          color: 0x666666,
          metalness: 0.4,
          roughness: 0.4,
        });
        const marker = new THREE.Mesh(markerGeom, markerMaterial);
        this.cylinderGroup.add(marker);
      }
    });
  }

  // Deformed markers (as opposed to simple cubes) may be OTT given how small the markers are
  _createDeformedMarkerGeometry(
    axialWidth,
    radialHeight,
    circumferentialLength,
    baseCylinderRadius,
    markerCenterX,
    markerCenterAngle
  ) {
    const geometry = new THREE.BufferGeometry();

    const epsilon = 0.05; // Small offset to prevent Z-fighting

    // The marker's bottom surface will be at baseCylinderRadius + epsilon
    // The marker's top surface will be at baseCylinderRadius + epsilon + radialHeight
    const actualBottomRadius = baseCylinderRadius + epsilon;
    const actualTopRadius = actualBottomRadius + radialHeight;

    // Calculate angular width based on the desired circumferential length
    // at the marker's intended visual mid-radius (before epsilon offset for Z-fighting)
    const visualMidRadius = baseCylinderRadius + radialHeight / 2;
    const angularWidth = circumferentialLength / visualMidRadius;

    const angleStart = markerCenterAngle - angularWidth / 2;
    const angleEnd = markerCenterAngle + angularWidth / 2;

    const xStart = markerCenterX - axialWidth / 2;
    const xEnd = markerCenterX + axialWidth / 2;

    // prettier-ignore
    const vertices = new Float32Array([
            // Bottom face (using actualBottomRadius)
            xStart, actualBottomRadius * Math.cos(angleStart), actualBottomRadius * Math.sin(angleStart), // p0
            xEnd,   actualBottomRadius * Math.cos(angleStart), actualBottomRadius * Math.sin(angleStart), // p1
            xStart, actualBottomRadius * Math.cos(angleEnd),   actualBottomRadius * Math.sin(angleEnd),   // p2
            xEnd,   actualBottomRadius * Math.cos(angleEnd),   actualBottomRadius * Math.sin(angleEnd),   // p3

            // Top face (using actualTopRadius)
            xStart, actualTopRadius * Math.cos(angleStart), actualTopRadius * Math.sin(angleStart), // p4
            xEnd,   actualTopRadius * Math.cos(angleStart), actualTopRadius * Math.sin(angleStart), // p5
            xStart, actualTopRadius * Math.cos(angleEnd),   actualTopRadius * Math.sin(angleEnd),   // p6
            xEnd,   actualTopRadius * Math.cos(angleEnd),   actualTopRadius * Math.sin(angleEnd)    // p7
        ]);

    // Consistent Counter-Clockwise (CCW) winding for faces (when viewed from the "outside" of
    // that face) is crucial for geometry.computeVertexNormals() to generate correct,
    // outward-pointing normals. Incorrect winding can lead to faces appearing dark or invisible.
    // prettier-ignore
    const indices = [
            // Bottom face (CCW from "below" marker, normal points towards cylinder axis / "down" locally)
            0, 1, 3,   0, 3, 2, // Quad p0-p1-p3-p2

            // Top face (CCW from "above" marker, normal points radially out from cylinder / "up" locally)
            4, 6, 7,   4, 7, 5, // Quad p4-p6-p7-p5

            // Side face at angleStart ("front" side along circumference, CCW from outside this face)
            0, 4, 5,   0, 5, 1, // Quad p0-p4-p5-p1

            // Side face at angleEnd ("back" side along circumference, CCW from outside this face)
            3, 6, 2,   3, 7, 6, // Quad p3-p2-p6-p7 (note vertex order for CCW)

            // Side face at xStart (axial "left", CCW from outside this face)
            0, 2, 6,   0, 6, 4, // Quad p0-p2-p6-p4

            // Side face at xEnd (axial "right", CCW from outside this face)
            1, 5, 7,   1, 7, 3  // Quad p1-p5-p7-p3
        ];

    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Generates a THREE.Vector2 array for a bevelled cylinder profile.
   *
   * This function creates the 2D profile (a cross-section) needed by
   * THREE.LatheGeometry to generate a 3D cylinder with bevelled top and
   * bottom edges. The profile is drawn along the positive X and Y axes,
   * centred vertically around the origin.
   *
   * @param {object} params - The parameters for the cylinder.
   * @param {number} params.radius - The radius of the cylinder.
   * @param {number} params.height - The total axial height of the cylinder.
   * @param {number} params.bevelSize - The size of the bevel (radius of the fillet).
   * @param {number} params.bevelSegments - The number of segments in the bevel's curve. More segments create a smoother curve.
   * @returns {THREE.Vector2[]} An array of THREE.Vector2 points for THREE.LatheGeometry.
   */
  _generateBevelledCylinderPoints({
    radius,
    height,
    bevelSize,
    bevelSegments,
  }) {
    const points = [];
    const halfHeight = height / 2;

    // Clamp the bevel size to prevent geometry errors
    const b = Math.min(bevelSize, radius, halfHeight);

    // --- Define the key vertices of the profile ---

    // P1: Top-center
    const p1 = { x: 0, y: halfHeight };
    // P2: Start of top bevel on the flat top surface
    const p2 = { x: radius - b, y: halfHeight };
    // P3: End of top bevel, start of the vertical side
    const p3 = { x: radius, y: halfHeight - b };
    // P4: End of the vertical side, start of the bottom bevel
    const p4 = { x: radius, y: -halfHeight + b };
    // P5: End of the bottom bevel, start of the flat bottom surface
    const p5 = { x: radius - b, y: -halfHeight };
    // P6: Bottom-center
    const p6 = { x: 0, y: -halfHeight };

    // --- Generate the points array by tracing the profile ---

    // Start at the top-center
    //points.push(new THREE.Vector2(p1.x, p1.y));
    points.push(new THREE.Vector2(p2.x, p2.y));

    // Generate the top bevel curve if the bevel is significant
    if (b > 0 && bevelSegments > 0) {
      const topBevelCenter = { x: p2.x, y: p3.y };
      for (let i = 1; i < bevelSegments; i++) {
        const angle = (Math.PI / 2) * (1 - i / bevelSegments);
        const x = topBevelCenter.x + b * Math.cos(angle);
        const y = topBevelCenter.y + b * Math.sin(angle);
        points.push(new THREE.Vector2(x, y));
      }
    }

    // Add the corner points - p3 & p4 - that define the main cylindrical shape
    points.push(new THREE.Vector2(p3.x, p3.y));
    {
      // Add some extra/redundant segments to increase the tessellation to get finer
      // control over the texture mapping
      const nSeg = 10; // extra segment count
      const hSeg = (p3.y - p4.y) / nSeg;
      for (let i = 1; i < nSeg; i++)
        points.push(new THREE.Vector2(p3.x, p3.y - i * hSeg)); // n-1 extra points
    }
    points.push(new THREE.Vector2(p4.x, p4.y));

    // Generate the bottom bevel curve
    if (b > 0 && bevelSegments > 0) {
      const bottomBevelCenter = { x: p5.x, y: p4.y };
      for (let i = 1; i < bevelSegments; i++) {
        const angle = -(Math.PI / 2) * (i / bevelSegments);
        const x = bottomBevelCenter.x + b * Math.cos(angle);
        const y = bottomBevelCenter.y + b * Math.sin(angle);
        points.push(new THREE.Vector2(x, y));
      }
    }

    // Add the final points to close the profile at the bottom-center
    points.push(new THREE.Vector2(p5.x, p5.y));
    //points.push(new THREE.Vector2(p6.x, p6.y));

    return points.reverse(); // We actually want the y coords going up
  }

  _onResize() {
    const camera = this.camera;
    const renderer = this.renderer;
    const targetEl = this.targetElement;
    if (!this.isRunning || !renderer || !camera || !targetEl) {
      console.log("_onResize() returning early", {
        isRunning: this.isRunning,
        hasRenderer: !!renderer,
        hasCamera: !!camera,
        hasTargetEl: !!targetEl,
      });
      return;
    }

    const width = targetEl.clientWidth;
    const height = targetEl.clientHeight;

    // ## Optimal Detail ##
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    // ## Maintain Camera Perspective ##

    // To ensure the rendered view is simply a magnified version of a smaller view,
    // we need to make sure that the visible area of the scene at a given distance
    // from the camera remains constant. In Three.js, the PerspectiveCamera's
    // vertical field of view (fov) and the canvas's aspect ratio determine what
    // is visible.
    // So we need to adjust the fov based on the canvas height.

    // The desired visible height of the scene at the camera's z-position.
    let visibleHeight = this.sceneHeight;

    // Display with extra height if the aspect ratio isn't wide enough to display
    // the cylinder without clipping.
    const ctAspectRatio = width / height;
    const sceneAspectRatio = this.sceneWidth / this.sceneHeight;
    if (ctAspectRatio < sceneAspectRatio) {
      visibleHeight *= sceneAspectRatio / ctAspectRatio;
    }

    const fov = 2 * Math.atan(visibleHeight / (2 * camera.position.z));
    camera.fov = THREE.MathUtils.radToDeg(fov);
    camera.aspect = width / height;
    camera.updateProjectionMatrix(); // crucial after changing camera parameters!
  }

  _animationLoop(timestamp) {
    if (!this.isRunning) return;

    // Throttle animation loop to spare the battery
    const delta = timestamp - this.lastTimestamp;
    const actualRateHz = Math.round(1000 / delta);
    if (actualRateHz < this.maxRateHz) {
      // // Show actual refresh rate in console
      // if (this.lastTimestamp !== -1 && actualRateHz !== this.lastRateHz)
      //   console.log(`Refresh rate: ${actualRateHz} Hz`);
      this.lastRateHz = actualRateHz;
      this.lastTimestamp = timestamp;

      // ## Animation ##
      if (this.cylinderGroup) {
        // Spinning 'upwards' on its horizontal axis
        this.cylinderGroup.rotation.x = timestamp * -0.0001;
      }

      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
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
    this.cylinderGroup = null;
    this.textureCanvas = null;
    this.textures = null;
    this.redIndexLines = [];
    this.options = null; // Allow options to be GC'd
  }
}

export default CylinderClock;
