import * as THREE from "three";

// Helper function to convert number to words (simplified for 1-59)
function numberToWords(num) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty"];

  if (num === 0) return "Zero"; // Should not happen for minutes in this context often
  if (num < 20) return ones[num];
  const digitOne = num % 10;
  const digitTen = Math.floor(num / 10);
  return tens[digitTen] + (digitOne !== 0 ? " " + ones[digitOne] : "");
}

// Appendix A: British English Time Text Generation
function getTimeStringENGB(date) {
  const h24 = date.getHours();
  const m = date.getMinutes();

  const H_display = h24 % 12 === 0 ? 12 : h24 % 12;
  const H_next_h24 = (h24 + 1) % 24;
  const H_next_display = H_next_h24 % 12 === 0 ? 12 : H_next_h24 % 12;

  const hourWords = {
    1: "One",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten",
    11: "Eleven",
    12: "Twelve",
  };

  if (m === 0) return `${hourWords[H_display]} o'clock`;
  if (m === 1) return `One minute past ${hourWords[H_display]}`;
  if (m > 1 && m < 15)
    return `${numberToWords(m)} minutes past ${hourWords[H_display]}`;
  if (m === 15) return `Quarter past ${hourWords[H_display]}`;
  if (m > 15 && m < 30)
    return `${numberToWords(m)} minutes past ${hourWords[H_display]}`;
  if (m === 30) return `Half past ${hourWords[H_display]}`;

  const minutes_to = 60 - m;
  if (m > 30 && m < 45) {
    return `${numberToWords(minutes_to)} minutes to ${
      hourWords[H_next_display]
    }`;
  }
  if (m === 45) return `Quarter to ${hourWords[H_next_display]}`;
  if (m > 45 && m < 59) {
    return `${numberToWords(minutes_to)} minutes to ${
      hourWords[H_next_display]
    }`;
  }
  if (m === 59) return `One minute to ${hourWords[H_next_display]}`;
  return ""; // Should not happen
}

// Appendix B: American English Time Text Generation
function getTimeStringENUS(date) {
  const h24 = date.getHours();
  const m = date.getMinutes();

  const H_display_num = h24 % 12 === 0 ? 12 : h24 % 12;
  const h_next_24 = (h24 + 1) % 24;
  const H_next_display_num = h_next_24 % 12 === 0 ? 12 : h_next_24 % 12;

  const hourWords = {
    // Using numerals for hours as per example, but spec seems to imply words sometimes.
    // Sticking to numbers for H_display_num for consistency with "10 thirty"
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "11",
    12: "12",
  };

  if (m === 0) return `${hourWords[H_display_num]} o'clock`;
  if (m === 1) return `One minute after ${hourWords[H_display_num]}`;
  if (m > 1 && m < 15)
    return `${numberToWords(m)} minutes after ${hourWords[H_display_num]}`;
  if (m === 15) return `Quarter after ${hourWords[H_display_num]}`;
  if (m > 15 && m < 30)
    return `${numberToWords(m)} minutes after ${hourWords[H_display_num]}`;
  if (m === 30) return `${hourWords[H_display_num]} thirty`;

  const minutes_to = 60 - m;
  if (m > 30 && m < 45) {
    if (minutes_to === 1)
      return `One minute to ${hourWords[H_next_display_num]}`;
    return `${numberToWords(minutes_to)} minutes to ${
      hourWords[H_next_display_num]
    }`;
  }
  if (m === 45) return `Quarter to ${hourWords[H_next_display_num]}`;
  if (m > 45 && m < 59) {
    if (minutes_to === 1)
      return `One minute to ${hourWords[H_next_display_num]}`;
    return `${numberToWords(minutes_to)} minutes to ${
      hourWords[H_next_display_num]
    }`;
  }
  if (m === 59) return `One minute to ${hourWords[H_next_display_num]}`;
  return ""; // Should not happen
}

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

    this.currentTime = new Date();
    this.manualTimeOffset = null; // Stores the difference if setTime is used

    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTimestamp = -1; // Last timestamp for animation loop

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cylinderMesh = null;
    this.textureCanvas = null;
    this.texture = null;
    this.redIndexLines = [];
    this.resizeObserver = null;

    try {
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

  _getEffectiveTime() {
    if (this.manualTimeOffset !== null) {
      return new Date(Date.now() + this.manualTimeOffset);
    }
    return new Date();
  }

  _getTimeString(date) {
    if (this.options.language === "en-GB") {
      return getTimeStringENGB(date);
    }
    // Default to en-US
    return getTimeStringENUS(date);
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
      50,
      this.targetElement.clientWidth / this.targetElement.clientHeight,
      0.1,
      1000
    );
    // Position camera to view the cylinder. This will be adjusted in _handleResize.

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7.5); // Experiment with position
    this.scene.add(directionalLight);

    // Texture
    this._createTexture();

    // Cylinder
    this._createCylinder();

    // Red Index Lines
    this._createRedIndexLines();

    // Initial Resize and Positioning
    this._handleResize();

    // Start animation
    this._animationLoop = this._animationLoop.bind(this);
    this.animationFrameId = window.requestAnimationFrame(this._animationLoop);

    // Setup responsiveness
    this.resizeObserver = new ResizeObserver(() => this._handleResize());
    this.resizeObserver.observe(this.targetElement);
  }

  _createTexture() {
    this.textureCanvas = document.createElement("canvas");
    const ctx = this.textureCanvas.getContext("2d");

    const textureFontPx = 48; // Base font size for texture clarity
    const majorMarkHeight = textureFontPx * 0.2;
    const minorMarkHeight = textureFontPx * 0.12;
    const markWidth = textureFontPx * 0.08; // For red lines to match minor mark

    const textPaddingY = textureFontPx * 0.6; // Padding above/below text
    const segmentHeight =
      textureFontPx +
      textPaddingY * 2 +
      majorMarkHeight +
      11 * (minorMarkHeight + textureFontPx * 0.1); // Approximate height for one minute segment

    const canvasHeight = segmentHeight * 60;
    const canvasWidth = 800; // Fixed width, can be dynamic based on longest text

    this.textureCanvas.width = canvasWidth;
    this.textureCanvas.height = canvasHeight;

    // Store mark width for red lines
    this.minorMarkWidthForRedLine = markWidth;

    ctx.fillStyle = this.options.cylinderSurfaceColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const tempDate = new Date(0, 0, 0, 0, 0, 0); // Use a fixed date for generating minutes

    const textMetrics = ctx.measureText("M"); // Approximate ascent
    const fontAscent =
      textMetrics.actualBoundingBoxAscent || textureFontPx * 0.75;
    const fontDescent =
      textMetrics.actualBoundingBoxDescent || textureFontPx * 0.25;

    for (let i = 0; i < 60; i++) {
      tempDate.setMinutes(i);
      const timeStr = this._getTimeString(tempDate);
      const yPos = i * segmentHeight;

      // Major Mark
      ctx.fillStyle = this.options.majorMarkColor;
      const majorMarkY = yPos + textPaddingY * 0.5; // Align near top of text band
      this._drawEmbossedRect(
        ctx,
        0,
        majorMarkY,
        canvasWidth / 10,
        majorMarkHeight,
        this.options.majorMarkColor
      );
      this._drawEmbossedRect(
        ctx,
        canvasWidth * (9 / 10),
        majorMarkY,
        canvasWidth / 10,
        majorMarkHeight,
        this.options.majorMarkColor
      );

      // Time Text
      ctx.font = `${textureFontPx}px ${this.options.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic"; // For more precise vertical alignment

      let textY;
      const textDrawHeight = fontAscent + fontDescent;

      if (this.options.textVerticalAlign === "top") {
        textY = majorMarkY + majorMarkHeight + fontAscent + 5;
      } else if (this.options.textVerticalAlign === "bottom") {
        textY =
          majorMarkY +
          (segmentHeight -
            textPaddingY * 0.5 -
            majorMarkHeight -
            11 * (minorMarkHeight + textureFontPx * 0.1)) -
          fontDescent -
          5;
      } else {
        // middle
        const bandCenterY =
          majorMarkY +
          (segmentHeight -
            textPaddingY -
            majorMarkHeight -
            11 * (minorMarkHeight + textureFontPx * 0.1)) /
            2;
        textY = bandCenterY + textDrawHeight / 2 - fontDescent;
      }
      this._drawEmbossedText(
        ctx,
        timeStr,
        canvasWidth / 2,
        textY,
        this.options.textColor
      );

      // Minor Marks
      ctx.fillStyle = this.options.minorMarkColor;
      let minorMarkStartY = majorMarkY + majorMarkHeight + textureFontPx * 0.2; // Start below major mark
      for (let j = 0; j < 11; j++) {
        const currentMinorMarkY =
          minorMarkStartY + j * (minorMarkHeight + textureFontPx * 0.12); // Mark + spacing
        this._drawEmbossedRect(
          ctx,
          0,
          currentMinorMarkY,
          canvasWidth / 12,
          minorMarkHeight,
          this.options.minorMarkColor
        );
        this._drawEmbossedRect(
          ctx,
          canvasWidth * (11 / 12),
          currentMinorMarkY,
          canvasWidth / 12,
          minorMarkHeight,
          this.options.minorMarkColor
        );
      }
    }

    this.texture = new THREE.CanvasTexture(this.textureCanvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
  }

  _drawEmbossedText(ctx, text, x, y, color) {
    const offset = 1.5;
    // Shadow (darker)
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillText(text, x + offset, y + offset);
    // Highlight (lighter version of base, or whiteish)
    const highlight = this._adjustColor(color, 40); // make it lighter
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(text, x - offset, y - offset);
    // Main text
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  _drawEmbossedRect(ctx, x, y, w, h, color) {
    const offset = 1;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + offset, y + offset, w, h);
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x - offset, y - offset, w, h);
    // Main rect
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  _adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, r + amount));
    g = Math.min(255, Math.max(0, g + amount));
    b = Math.min(255, Math.max(0, b + amount));
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  _createCylinder() {
    const divHeight = this.targetElement.clientHeight;
    const cylinderRadius = divHeight / 2.5; // Make cylinder diameter a bit smaller than div height
    const cylinderLength = cylinderRadius * 2 * 3; // L = 3 * D

    const geometry = new THREE.CylinderGeometry(
      cylinderRadius,
      cylinderRadius,
      cylinderLength,
      64,
      60,
      false
    ); // 60 vertical segments for 60 minutes

    // Adjust UV mapping for vertical text scroll
    const uvs = geometry.attributes.uv.array;
    for (let i = 0; i < uvs.length; i += 2) {
      // uvs[i] is U (horizontal, around circumference)
      // uvs[i+1] is V (vertical, along length)
      // We want texture V to map around circumference, texture U along length
      let temp = uvs[i];
      uvs[i] = uvs[i + 1]; // V from texture maps to circumference
      uvs[i + 1] = 1.0 - temp; // U from texture maps to length (inverted)
    }
    geometry.attributes.uv.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      color: 0xffffff, // Base color, texture will dominate
      roughness: 0.6, // Semi-reflective ivory
      metalness: 0.1,
      side: THREE.FrontSide, // Render only front
    });

    this.cylinderMesh = new THREE.Mesh(geometry, material);
    this.cylinderMesh.rotation.z = Math.PI / 2; // Orient horizontally along X-axis
    this.scene.add(this.cylinderMesh);
  }

  _createRedIndexLines() {
    // Remove old lines if any
    this.redIndexLines.forEach((line) => this.scene.remove(line));
    this.redIndexLines = [];

    if (!this.cylinderMesh || !this.cylinderMesh.geometry) return;

    const cylinderRadius = this.cylinderMesh.geometry.parameters.radiusTop;
    const cylinderLength = this.cylinderMesh.geometry.parameters.height;

    // Estimate mark column positions (these are approximate)
    // The marks are drawn on texture at 0% and 90% of texture width approx.
    // Texture U=0 is one end of cylinder, U=1 is other end.
    // Marks are at extreme left/right of cylinder, near the ends.
    const markWidthOnCylinder = cylinderLength * (1 / 10); // Width of mark strip on cylinder length
    const lineLength = markWidthOnCylinder * 0.8; // Red line slightly shorter than mark column
    const lineThickness = this.minorMarkWidthForRedLine
      ? this.minorMarkWidthForRedLine * 0.2
      : 2; // Approx based on texture calculation

    const linePositionsX = [
      -cylinderLength / 2 + markWidthOnCylinder / 2, // Left side
      cylinderLength / 2 - markWidthOnCylinder / 2, // Right side
    ];

    const color = new THREE.Color(this.options.redLineColor);
    const alpha = this.options.redLineColor.includes("rgba")
      ? parseFloat(this.options.redLineColor.split(",")[3])
      : 1.0;

    linePositionsX.forEach((posX) => {
      const lineGeometry = new THREE.PlaneGeometry(lineLength, lineThickness);
      const lineMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: alpha < 1.0,
        opacity: alpha,
        side: THREE.DoubleSide,
      });
      const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
      // Position in front of the cylinder surface, at horizontal center
      lineMesh.position.set(posX, 0, cylinderRadius + 0.1); // X is along length, Z is depth for line
      // Red lines are static relative to camera view, so no rotation with cylinder
      // If cylinder itself rotates on Y, these lines' X and Z need to be static in view.
      // For cylinder rotating on X (its own axis, if it's aligned with world Y):
      lineMesh.rotation.z = Math.PI / 2; // if cylinder axis is world Y, red lines horizontal
      // If cylinder geometry is rotated (e.g. mesh.rotation.z = PI/2), then line positions need to map to that.
      // Current setup: cylinder is mesh.rotation.z = PI/2. World X becomes cylinder length. World Y is up/down on cylinder face. World Z is cylinder radius.
      // So line should be horizontal along X, thickness along Y, at some Z.

      // Line is horizontal, so geometry is width (lineLength) by height (lineThickness)
      // Position: x is along cylinder length, y is vertical center of div, z is front
      lineMesh.position.set(posX, 0, cylinderRadius + 0.5); // posX varies, Y=0, Z slightly in front
      // No rotation needed if lines are plane facing camera
      this.scene.add(lineMesh);
      this.redIndexLines.push(lineMesh);
    });
  }

  _handleResize() {
    if (
      !this.renderer ||
      !this.camera ||
      !this.targetElement ||
      !this.cylinderMesh
    )
      return;

    const width = this.targetElement.clientWidth;
    const height = this.targetElement.clientHeight;

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;

    // Adjust cylinder geometry or camera to fit
    // Keep cylinder L = 3 * D. D is 2 * radius.
    let cylinderRadius, cylinderLength;

    // Option: Scale cylinder to fit div
    const typicalAspectRatio = 3 / 1; // Cylinder L/D
    const divAspect = width / height;

    if (divAspect > typicalAspectRatio) {
      // Div is wider than typical cylinder aspect
      // Fit to height
      cylinderRadius = height / 2.5;
    } else {
      // Div is taller or equal aspect
      // Fit to width (L = width)
      cylinderRadius = width / typicalAspectRatio / 2.5;
    }
    cylinderLength = typicalAspectRatio * (cylinderRadius * 2);

    // Update cylinder geometry (if needed, or scale mesh)
    // For simplicity, let's assume the initial geometry is okay and we adjust camera
    // Or, rebuild geometry (more complex to do on each resize for existing texture mapping)
    // Scaling the mesh is easier:
    if (
      this.cylinderMesh.geometry.parameters.radiusTop !== cylinderRadius ||
      this.cylinderMesh.geometry.parameters.height !== cylinderLength
    ) {
      // Recreate geometry (this might be heavy) or scale the mesh
      // Simple scaling for now:
      const oldRadius = this.cylinderMesh.geometry.parameters.radiusTop;
      //const oldLength = this.cylinderMesh.geometry.parameters.height;
      //this.cylinderMesh.scale.set(cylinderLength/oldLength, cylinderRadius/oldRadius, cylinderRadius/oldRadius);
      // Re-creating is safer for UVs and complex interactions
      this.scene.remove(this.cylinderMesh);
      this.cylinderMesh.geometry.dispose();
      this.cylinderMesh.material.dispose(); // Texture is shared, don't dispose it.
      this._createCylinder(); // Will use current targetElement dimensions
      this._createRedIndexLines(); // Re-create red lines based on new cylinder size
    }

    // Adjust camera position to frame the (potentially new sized) cylinder
    // Fit cylinder (length `actualCylinderLength`, diameter `2 * actualCylinderRadius`)
    const actualCylinderRadius =
      this.cylinderMesh.geometry.parameters.radiusTop;
    const actualCylinderLength = this.cylinderMesh.geometry.parameters.height;

    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const distToFitHeight = actualCylinderRadius / Math.tan(fovRad / 2);
    const distToFitWidth =
      actualCylinderLength / 2 / (Math.tan(fovRad / 2) * this.camera.aspect);

    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.position.z =
      Math.max(distToFitHeight, distToFitWidth) * 1.1 + actualCylinderRadius; // 1.1 for padding
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
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
    // Show actual refresh rate in console
    // if (this.lastTimestamp !== -1) {
    //   const refreshRate = Math.round(1000 / delta);
    //   console.log(`Refresh rate: ${refreshRate} Hz`);
    // }
    this.lastTimestamp = timestamp;

    const now = this._getEffectiveTime();
    const totalSecondsContinuous =
      now.getHours() * 3600 +
      now.getMinutes() * 60 +
      now.getSeconds() +
      now.getMilliseconds() / 1000;
    const totalMinutesFloat = totalSecondsContinuous / 60;

    // Cylinder rotation (physical rotation of the mesh)
    // Rotates once every `cylinderMinuteCount` minutes
    // The cylinder is oriented with its length along WORLD X-axis (after initial PI/2 rotation on Z)
    // So, rotation for text scrolling UP on front face should be around its own length-axis (initially World X).
    const physicalRotationSpeedFactor = 1 / this.options.cylinderMinuteCount; // Rotations per minute
    this.cylinderMesh.rotation.x =
      (totalMinutesFloat * physicalRotationSpeedFactor * 2 * Math.PI) %
      (2 * Math.PI);

    // Texture scrolling to keep current time centered
    // Texture V coordinate (0 to 1) maps around circumference.
    // Target V = (current minute fraction of hour)
    // We want the current minute string (at its `v_target`) to be at the top (or front-center) of the cylinder.
    // If cylinder's physical rotation is `phi_phys = cylinderMesh.rotation.x`
    // And texture V maps to angle `alpha_tex = v * 2 * PI`
    // A point on texture `v` is at angle `alpha_tex - phi_phys` relative to a static view.
    // We want `v_current_minute = (totalMinutesFloat % 60) / 60` to be at view angle 0 (e.g. top/front).
    // So, `(v_current_minute + texture.offset.y) * 2*PI - phi_phys = 0` (mod 2PI)
    // `texture.offset.y = (phi_phys / (2*PI)) - v_current_minute`
    // This makes texture offset.y scroll. Positive offset.y shifts texture image "down", so what's visible moves "up".

    const currentMinuteFractionInHour = (totalMinutesFloat % 60) / 60; // Value from 0 to 1 representing progress through the 60 min cycle

    // Effective rotation related to `cylinderMinuteCount` (N)
    // Cylinder rotates such that its surface moves (totalMinutesFloat / N) full circles.
    // The angle corresponding to this physical rotation is `(totalMinutesFloat / N) * 2 * PI`.
    // This is `this.cylinderMesh.rotation.x`.

    // The texture offset ensures that despite this physical rotation, the correct minute mark is at the 'zero' angular position.
    // If texture V=0 is minute 0, V=0.5 is minute 30 etc.
    // The part of texture that should be at angular position 0 (e.g. top/front) is `currentMinuteFractionInHour`.
    // `texture.offset.y` is the amount the texture's V=0 point is shifted from the geometry's v=0 point.
    // Angle of geometry's v=0 point due to physical rotation = `this.cylinderMesh.rotation.x`.
    // We want texture `v = currentMinuteFractionInHour` to be at this physical angle.
    // `(currentMinuteFractionInHour - texture.offset.y) * 2 * PI = this.cylinderMesh.rotation.x` (modulo 2PI)
    // `texture.offset.y = currentMinuteFractionInHour - (this.cylinderMesh.rotation.x / (2 * PI))`

    this.texture.offset.y =
      currentMinuteFractionInHour -
      this.cylinderMesh.rotation.x / (2 * Math.PI);
    // Ensure offset.y is always positive and wraps correctly for THREE.RepeatWrapping
    this.texture.offset.y = ((this.texture.offset.y % 1) + 1) % 1;

    // Red index lines: update positions if they are not using screen-space coordinates
    // If they are fixed in the scene relative to cylinder, their apparent position changes as camera moves.
    // For static overlay appearance, might need to project to screen space or use an overlay scene.
    // For now, they are positioned relative to cylinder radius, should be okay if camera looks at origin.
    // However, their X position is based on cylinder length, which can change on resize.
    // _createRedIndexLines is called in _handleResize, so their positions will update.

    this.renderer.render(this.scene, this.camera);

    if (this.isRunning) {
      this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
    }
  }

  setTime(dateObject) {
    if (!(dateObject instanceof Date) || isNaN(dateObject.getTime())) {
      console.warn("setTime: Invalid Date object provided.");
      return;
    }
    // Calculate the difference between the new time and what the current system time *would be* now.
    // This offset will be added to Date.now() in _getEffectiveTime().
    this.manualTimeOffset = dateObject.getTime() - Date.now();
    // Force an immediate update of the display
    const now = this._getEffectiveTime();
    const totalSecondsContinuous =
      now.getHours() * 3600 +
      now.getMinutes() * 60 +
      now.getSeconds() +
      now.getMilliseconds() / 1000;
    const totalMinutesFloat = totalSecondsContinuous / 60;
    const currentMinuteFractionInHour = (totalMinutesFloat % 60) / 60;

    this.cylinderMesh.rotation.x =
      (totalMinutesFloat *
        (1 / this.options.cylinderMinuteCount) *
        2 *
        Math.PI) %
      (2 * Math.PI);
    this.texture.offset.y =
      currentMinuteFractionInHour -
      this.cylinderMesh.rotation.x / (2 * Math.PI);
    this.texture.offset.y = ((this.texture.offset.y % 1) + 1) % 1;
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
