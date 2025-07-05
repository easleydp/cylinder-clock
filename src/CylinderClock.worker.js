import * as THREE from "three";
import { MathUtils } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RectAreaLightHelper } from "three/addons/helpers/RectAreaLightHelper.js";
// import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// import Stats from "three/addons/libs/stats.module.js";
// import { GUI } from "dat.gui";

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

// British English Time Text Generation
function getTimeStringENGB(date) {
  let min = date.getMinutes();
  let hr = date.getHours();
  const past = min <= 30;
  const pastTo = past ? " past " : " to ";

  if (!past) hr++;

  hr = hr > 12 ? hr - 12 : hr;
  min = past ? min : 60 - min;

  //widest possible example: return "24 minutes past 12";
  if (min === 0) return hr + " o'clock";
  if (min === 15) return "quarter" + pastTo + hr;
  if (min === 30) return "half" + pastTo + hr;
  if (min % 5 === 0) return min + pastTo + hr;
  return min + " minute" + (min !== 1 ? "s" : "") + pastTo + hr;
  // const h24 = date.getHours();
  // const m = date.getMinutes();

  // const H_display = h24 % 12 === 0 ? 12 : h24 % 12;
  // const H_next_h24 = (h24 + 1) % 24;
  // const H_next_display = H_next_h24 % 12 === 0 ? 12 : H_next_h24 % 12;

  // const hourWords = {
  //   1: "One",
  //   2: "Two",
  //   3: "Three",
  //   4: "Four",
  //   5: "Five",
  //   6: "Six",
  //   7: "Seven",
  //   8: "Eight",
  //   9: "Nine",
  //   10: "Ten",
  //   11: "Eleven",
  //   12: "Twelve",
  // };

  // if (m === 0) return `${hourWords[H_display]} o'clock`;
  // if (m === 1) return `One minute past ${hourWords[H_display]}`;
  // if (m > 1 && m < 15)
  //   return `${numberToWords(m)} minutes past ${hourWords[H_display]}`;
  // if (m === 15) return `Quarter past ${hourWords[H_display]}`;
  // if (m > 15 && m < 30)
  //   return `${numberToWords(m)} minutes past ${hourWords[H_display]}`;
  // if (m === 30) return `Half past ${hourWords[H_display]}`;

  // const minutes_to = 60 - m;
  // if (m > 30 && m < 45) {
  //   return `${numberToWords(minutes_to)} minutes to ${
  //     hourWords[H_next_display]
  //   }`;
  // }
  // if (m === 45) return `Quarter to ${hourWords[H_next_display]}`;
  // if (m > 45 && m < 59) {
  //   return `${numberToWords(minutes_to)} minutes to ${
  //     hourWords[H_next_display]
  //   }`;
  // }
  // if (m === 59) return `One minute to ${hourWords[H_next_display]}`;
  // return ""; // Should not happen
}

// American English Time Text Generation
function getTimeStringENUS(date) {
  const h24 = date.getHours();
  const m = date.getMinutes();

  const H_display_num = h24 % 12 === 0 ? 12 : h24 % 12;
  const h_next_24 = (h24 + 1) % 24;
  const H_next_display_num = h_next_24 % 12 === 0 ? 12 : h_next_24 % 12;

  // Using numerals for hours as per example, but spec seems to imply words sometimes.
  // Sticking to numbers for H_display_num for consistency with "10 thirty"
  const hourWords = {
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
  if (m === 30) return `${hourWords[H_display_num]} thirty`;

  const minutes_to = 60 - m;
  if (m > 30) {
    if (minutes_to === 15) return `Quarter to ${hourWords[H_next_display_num]}`;
    const minText =
      minutes_to === 1 ? "One minute" : `${numberToWords(minutes_to)} minutes`;
    return `${minText} to ${hourWords[H_next_display_num]}`;
  } else {
    if (m === 15) return `Quarter after ${hourWords[H_display_num]}`;
    const minText = m === 1 ? "One minute" : `${numberToWords(m)} minutes`;
    return `${minText} after ${hourWords[H_display_num]}`;
  }
}

const TAU = 2 * Math.PI;
const HALF_PI = Math.PI / 2;

/**
 * Wraps an angle to the range [0, 2π) using euclidean modulo.
 * @param {number} angle - The angle to wrap.
 * @returns {number} Wrapped angle in [0, 2π)
 */
function wrapAngle(angle) {
  return MathUtils.euclideanModulo(angle, TAU);
}

class ColorGUIHelper {
  constructor(object, prop) {
    this.object = object;
    this.prop = prop;
  }
  get value() {
    return `#${this.object[this.prop].getHexString()}`;
  }
  set value(hexString) {
    this.object[this.prop].set(hexString);
  }
}

class DegRadHelper {
  constructor(obj, prop) {
    this.obj = obj;
    this.prop = prop;
  }
  get value() {
    return MathUtils.radToDeg(this.obj[this.prop]);
  }
  set value(v) {
    this.obj[this.prop] = MathUtils.degToRad(v);
  }
}

class CylinderClockRenderer {
  constructor() {
    this.options = {};

    this.cylDiameter = 3;
    this.cylAxialLength = 15;
    // We don't want the cylinder rendered right up against the canvas edges
    this.sceneHeight = this.cylDiameter + 0.5;
    this.sceneWidth = this.cylAxialLength + 2.0;

    this.markerDepth = 0.06; // Thickness of the marker (embossed'ness)
    this.minorMarkerCircumferentialLength = this.cylDiameter / 85;
    this.minorMarkerAxialWidth = 0.5; // Width along the cylinder's length
    this.majorMarkerCircumferentialLength = this.cylDiameter / 35;
    this.majorMarkerAxialWidth = this.minorMarkerAxialWidth * 1.4;
    this.markerEndBuffer =
      Math.max(this.majorMarkerAxialWidth, this.minorMarkerAxialWidth) / 2 +
      0.02;

    // The number of major markers (minute markers) that are rendered around the circumference.
    // Must be greater than 1. Sensible values start at 3. 4 or 5 works well.
    this.numMajorMarkers = 4;
    this.numMinorMarkersBetweenMajor = 11;

    // Text config
    this.textSize = 1;
    this.textDepth = 0.08;
    this.baseCurveSegments = 12;

    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTimestamp = -1; // Last timestamp for animation loop
    this.maxRateHz = 30;
    this.lastRateHz = this.maxRateHz;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cylinderGroup = null;
    this.textLines = [];
    this.redIndexLines = [];
    this.textures = null;
    this.font = null;
    this.textGeometryWorker = null;
  }

  async init(canvas, options, initialWidth, initialHeight, pixelRatio) {
    this.pixelRatio = pixelRatio;
    // TODO: review these options (are they all actually used?)
    this.options = {
      language: "en-US",
      textColor: "#1C1C1C",
      cylinderSurfaceColor: "#F5F5DC",
      redLineColor: "rgb(255, 40, 40)",
      majorMarkColor: "#1C1C1C",
      minorMarkColor: "#333333",
      fontFamily: "Arial, sans-serif",
      textVerticalAlign: "middle",
      cylinderMinuteCount: 5,
      ...options,
    };

    if (this.numMajorMarkers < 2)
      throw new Error("numMajorMarkers must be greater than 1");

    if (this.isRunning) return;
    this.isRunning = true;

    this.textGeometryWorker = new Worker(
      new URL("./TextGeometryWorker.js", import.meta.url),
      { type: "module" }
    );
    this.textGeometryWorker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === "geometry") {
        const { geometry, originalPayload } = payload;
        const { timeInMinutes } = originalPayload;

        const textLine = this.textLines.find(
          (tl) => tl.timeInMinutes === timeInMinutes
        );
        if (textLine) {
          const newGeometry = new THREE.BufferGeometry();
          newGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(geometry.position), 3)
          );
          newGeometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(new Float32Array(geometry.normal), 3)
          );

          textLine.mesh.geometry.dispose();
          textLine.mesh.geometry = newGeometry;
        } else {
          console.error(
            `TextGeometryWorker error - failed to find textLine with timeInMinutes=${timeInMinutes}`
          );
        }
      } else if (type === "error") {
        console.error(
          "TextGeometryWorker error:",
          payload.message,
          payload.stack
        );
      }
    };

    this.scene = new THREE.Scene();

    // ## Camera Setup ##
    // The initial camera setup. The aspect ratio and fov will be adjusted
    // dynamically by the ResizeObserver.
    const aspect = initialWidth / initialHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    // The generated cylinder is quite large, so we need to move the camera
    // back to be able to see it.
    this.camera.position.z = 30;

    // ## Renderer Setup ##
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // renderer size set in onResize

    // ## Lighting ##
    this._createLighting(this.scene);

    await this._createCylinder();
    this._createMarkersAndText();
    this._createRedIndexLines();

    // Initial resize call to set everything up.
    this._onResize(initialWidth, initialHeight, this.pixelRatio);

    // Start animation
    this._animationLoop = this._animationLoop.bind(this);
    this.animationFrameId = self.requestAnimationFrame(this._animationLoop);

    // Monitor for oldest text line appearing round the back. Then
    // commence updating the oldest text line every one minute.
    const commenceUpdatingOldestTextLine = () => {
      // console.log("commenceUpdatingOldestTextLine");
      const oneMinute = 1000 * 60;
      let nextStartTime = Date.now();
      const loop2 = () => {
        nextStartTime += oneMinute;
        this._updateOldestTextLine();
        setTimeout(() => {
          loop2();
        }, nextStartTime - Date.now());
      };
      loop2();
    };

    const loop1 = () => {
      setTimeout(() => {
        if (this._oldestTextLineIsRoundTheBack())
          commenceUpdatingOldestTextLine();
        else loop1();
      }, 1000);
    };
    loop1();
  }

  _getTimeStringFn() {
    switch (this.options.language.toLowerCase()) {
      case "en-gb":
        return getTimeStringENGB;
      case "en-us":
        return getTimeStringENUS;
      default:
        console.warn(
          `Unsupported language: ${this.options.language}, defaulting to en-US.`
        );
        return getTimeStringENUS;
    }
  }

  _createLighting(scene) {
    // const gui = new GUI();
    // const makeXYZGUI = function (gui, vector3, name, onChangeFn) {
    //   const folder = gui.addFolder(name);
    //   folder.add(vector3, "x", -10, 10).onChange(onChangeFn);
    //   folder.add(vector3, "y", -10, 10).onChange(onChangeFn);
    //   folder.add(vector3, "z", -10, 60).onChange(onChangeFn);
    //   folder.open();
    // };

    // const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    // scene.add(ambientLight);
    // gui.add(ambientLight, "intensity", 0, 5, 0.01);

    RectAreaLightUniformsLib.init();
    const rectLight = new THREE.RectAreaLight(0xffffff, 27, 50, 4);
    rectLight.position.set(0, -10, 55);
    rectLight.rotation.x = MathUtils.degToRad(30);
    scene.add(rectLight);

    // const helper = new RectAreaLightHelper(rectLight);
    // rectLight.add(helper);
    // gui.addColor(new ColorGUIHelper(rectLight, "color"), "value").name("color");
    // gui.add(rectLight, "intensity", 0, 30);
    // gui.add(rectLight, "width", 0, 50);
    // gui.add(rectLight, "height", 0, 40);
    // gui
    //   .add(new DegRadHelper(rectLight.rotation, "x"), "value", -180, 180)
    //   .name("x rotation");
    // gui
    //   .add(new DegRadHelper(rectLight.rotation, "y"), "value", -180, 180)
    //   .name("y rotation");
    // gui
    //   .add(new DegRadHelper(rectLight.rotation, "z"), "value", -180, 180)
    //   .name("z rotation");
    // makeXYZGUI(gui, rectLight.position, "position");

    // const hemisphereLight = new THREE.HemisphereLight(0x666666, 0xffffff, 1.5);
    // scene.add(hemisphereLight);
    // const direcLight = new THREE.DirectionalLight(0xffffff, 0.5);
    // direcLight.position.set(50, 148, 7.5);
    // scene.add(direcLight);
    // const direcLight2 = new THREE.DirectionalLight(0xffffff, 1.6);
    // direcLight2.position.set(-5, -10, 7.5);
    // scene.add(direcLight2);

    const direcLightTop = new THREE.DirectionalLight(0xffffff, 0.4);
    direcLightTop.position.set(1.2, 2.0, 4.5);
    direcLightTop.castShadow = true;

    // Configure the shadow camera
    direcLightTop.shadow.camera.left = -this.cylAxialLength / 2 - 2;
    direcLightTop.shadow.camera.right = this.cylAxialLength / 2 + 2;
    direcLightTop.shadow.camera.top = this.cylDiameter / 2 + 2;
    direcLightTop.shadow.camera.bottom = -this.cylDiameter / 2 - 2;
    direcLightTop.shadow.camera.near = 0.5;
    direcLightTop.shadow.camera.far = 50;
    direcLightTop.shadow.mapSize.width = 2048;
    direcLightTop.shadow.mapSize.height = 2048;

    scene.add(direcLightTop);

    const direcLightBottom = new THREE.DirectionalLight(0xffffff, 0.3);
    direcLightBottom.position.set(-1.0, -3.8, -1.0);
    scene.add(direcLightBottom);

    // const helper = new THREE.DirectionalLightHelper(
    //   direcLightBottom,
    //   5,
    //   0xff0000
    // );
    // scene.add(helper);

    // gui.add(direcLightBottom, "intensity", 0, 5, 0.01);
    // gui.add(direcLightBottom.position, "x", -2, 2);
    // gui.add(direcLightBottom.position, "y", -10, 10);
    // gui.add(direcLightBottom.position, "z", -20, 20);
    // gui.add(light.target.position, "x", -5, 5);
    // gui.add(light.target.position, "y", 0, 10);
    // gui.add(light.target.position, "z", -10, 10);
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

    // TODO: Fix this to actually use promises. (Since Gemini-CLI modified it to use ImageBitmap, we lost the promises.)
    const promises = Object.entries(fileTails).map(async ([key, fileTail]) => {
      if (!fileTail) {
        return [key, null];
      }
      const path = `/assets/textures/${folder}/${fileStem}${fileTail}`;
      try {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        const texture = new THREE.Texture(imageBitmap);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        texture.needsUpdate = true;
        // ImageBitmaps are decoded with the origin at the top-left, which is what WebGL expects.
        // Three.js's TextureLoader flips UVs for historical reasons with HTMLImageElement.
        // We set flipY to false to prevent this inversion when using ImageBitmap.
        texture.flipY = false;
        return [key, texture];
      } catch (err) {
        console.error(`Failed to load texture ${path}: ${err.message}`);
        return [key, null]; // Resolve with null on error
      }
    });

    const results = await Promise.all(promises);
    return results.reduce((accum, [key, texture]) => {
      accum[key] = texture;
      return accum;
    }, {});
  }

  async _createCylinder() {
    const points = this._generateBevelledCylinderPoints({
      radius: this.cylDiameter / 2,
      height: this.cylAxialLength,
      bevelSize: 0.04,
      bevelSegments: 2, // Use more segments for a smoother bevel
    });
    const geometry = new THREE.LatheGeometry(points, 64);

    const [textures] = await Promise.all([this._loadTextures()]);
    this.textures = textures;

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
    mesh.receiveShadow = true;

    // Ambient occlusion maps (aoMap) use a second set of UV coordinates, stored in geometry.attributes.uv2.
    // However, most geometries (like THREE.CylinderGeometry) only generate one UV set by default (geometry.attributes.uv),
    // which is used for color textures, normal maps, etc. So this line copies the existing UV set to uv2, allowing the AO
    // map to be applied using the same UVs. Without this, the ambient occlusion texture won’t be displayed at all.
    mesh.geometry.attributes.uv2 = mesh.geometry.attributes.uv;

    // Orient the cylinder horizontally
    mesh.rotation.z = HALF_PI;

    // Cylinder, markers and text will rotate together in a group
    this.cylinderGroup = new THREE.Group();
    this.cylinderGroup.add(mesh);
    // Rotate the coordinate system so that 0 degrees maps to the front of the
    // horizontal cylinder (consistent with the red index lines) rather than the
    // top. (This will make the code easier to understand when we add markers and
    // text to the cylinder group.)
    // To establish a new "zero-degree" orientation for our cylinder group we
    // apply a one-time, initial rotation to a parent group. This
    // effectively creates a new local coordinate system for our cylinder and its
    // associated text & markers, simplifying the animation logic.
    const cylinderParentGroup = new THREE.Group();
    cylinderParentGroup.rotation.x = Math.PI / 2;
    cylinderParentGroup.add(this.cylinderGroup);

    this.scene.add(cylinderParentGroup);
  }

  _createRedIndexLines() {
    const pencilRadius = this.majorMarkerCircumferentialLength * 0.66;
    const pencilLength = this.majorMarkerAxialWidth * 2.5;

    const points = [];
    points.push(new THREE.Vector2(0, 0));
    points.push(new THREE.Vector2(pencilRadius * 0.33, 0.02));
    points.push(new THREE.Vector2(pencilRadius * 0.9, pencilLength * 0.05));
    points.push(new THREE.Vector2(pencilRadius, pencilLength * 0.075));
    points.push(new THREE.Vector2(pencilRadius, pencilLength));
    points.push(new THREE.Vector2(0, pencilLength));

    const geometry = new THREE.LatheGeometry(points, 12);
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.options.redLineColor),
      transmission: 1.0,
      roughness: 0.1,
      metalness: 0.0,
      ior: 1.5,
      thickness: 0.15,
      transparent: true,
      opacity: 0.7,
    });

    const lineLeft = new THREE.Mesh(geometry, material);
    lineLeft.castShadow = true;
    const lineRight = new THREE.Mesh(geometry, material);
    lineRight.castShadow = true;

    const y = 0; // Vertical center
    const z = this.cylDiameter / 2 + 0.3; // Slightly in front of the cylinder
    const x = this.cylAxialLength / 2 - pencilLength + 0.1;

    lineLeft.position.set(-x, y, z);
    lineRight.position.set(x, y, z);

    // The lathe geometry creates the pencil pointing along the +Y axis.
    // We need to rotate it around the Z-axis to make it horizontal and point inwards.
    lineLeft.rotation.z = HALF_PI; // Point right (inwards)
    lineRight.rotation.z = -HALF_PI; // Point left (inwards)

    this.scene.add(lineLeft, lineRight);
    this.redIndexLines = [lineLeft, lineRight];
  }

  _createMarkersAndText() {
    const numMajorMarkers = this.numMajorMarkers;
    const totalMarkersPerEnd =
      numMajorMarkers * (1 + this.numMinorMarkersBetweenMajor);
    const markerAngleIncrement = TAU / totalMarkersPerEnd;

    const cylinderMarkerPlacementX =
      this.cylAxialLength / 2 - this.markerEndBuffer;
    const markerXPositions = [
      -cylinderMarkerPlacementX,
      cylinderMarkerPlacementX,
    ];

    const textLines = (this.textLines = []);
    const getTimeString = this._getTimeStringFn();

    // We will adopt the convention that the horizontal line running along the
    // front of the cylinder is 0°.
    // We want the first major marker to be towards the front of the cylinder and
    // to correspond with the last whole minute (of 'time now'). So this marker
    // should be positioned at an angle between 0 and 2π/numMajorMarkers.
    const timeNow = Date.now();
    const oneMinute = 1000 * 60;
    const progress = (timeNow % oneMinute) / oneMinute;

    const angleMinuteShift =
      // Offset to shift the latest minute to somewhere between 0° and 360°/numMajorMarkers
      -(progress * TAU) / numMajorMarkers;

    const material = new THREE.MeshStandardMaterial({
      color: 0x777777,
      metalness: 0.4,
      roughness: 0.4,
    });

    markerXPositions.forEach((markerCenterX) => {
      for (let i = 0, j = 0; i < totalMarkersPerEnd; i++) {
        const isMajor = i % (this.numMinorMarkersBetweenMajor + 1) === 0;

        const axialWidth = isMajor
          ? this.majorMarkerAxialWidth
          : this.minorMarkerAxialWidth;
        const radialHeight = isMajor ? this.markerDepth : this.markerDepth / 3;
        const circumferentialLength = isMajor
          ? this.majorMarkerCircumferentialLength
          : this.minorMarkerCircumferentialLength;

        const markerAngle = wrapAngle(
          i * markerAngleIncrement + angleMinuteShift
        );

        const markerGeom = this._createDeformedMarkerGeometry(
          axialWidth,
          radialHeight,
          circumferentialLength,
          this.cylDiameter / 2,
          markerCenterX,
          markerAngle
        );
        const marker = new THREE.Mesh(markerGeom, material);
        this.cylinderGroup.add(marker);

        // # Add text #
        if (isMajor && markerCenterX > 0) {
          const roundTheBack = this._roundTheBack(markerAngle);
          // To begin with (first pass) the first minute is always the last
          // whole minute (which can be up one minute in the past). As the
          // loop progresses, markerAngle is 'increasing' so we begin
          // generating text lines projected into the future. We continue
          // in this vain through the 'round the back' zone. Once we emerge
          // out of this invisible rear quadrant we switch to generating
          // historical text lines, since they may still be visible before
          // disappearing over the top of the cylinder.
          const offsetMinutes =
            j <= numMajorMarkers / 2 || roundTheBack ? j : j - numMajorMarkers;
          const oneMinute = 1000 * 60;
          const timeNowToLastMinute = Math.floor(timeNow / oneMinute);
          const timeInMinutes = timeNowToLastMinute + offsetMinutes;
          const displayText = getTimeString(
            new Date(timeInMinutes * oneMinute)
          );

          const textLine = {
            mesh: new THREE.Mesh(new THREE.BufferGeometry(), material),
            timeInMinutes,
            displayText, // Just for diag purposes
          };
          textLines.push(textLine);
          this.cylinderGroup.add(textLine.mesh);
          this._requestCreateTextGeom(textLine, markerAngle);
          j++;
        }
      }
    });
  }

  /**
   * @param {Number} angle in radians
   * @returns true if `angle` is in the rear quadrant (which we take
   * to be reliably out of view, even when considered raised text)
   */
  _roundTheBack(angle) {
    const eightTau = TAU / 8;
    return eightTau * 3 < angle && angle < eightTau * 5;
  }

  _oldestTextLine() {
    return this.textLines.reduce((minItem, currentItem) =>
      currentItem.timeInMinutes < minItem.timeInMinutes ? currentItem : minItem
    );
  }

  _oldestTextLineIsRoundTheBack() {
    const oldest = this._oldestTextLine();
    const lineTime = oldest.timeInMinutes * 60 * 1000;
    const cylCycleTime = this.numMajorMarkers * 60 * 1000;
    const angle = wrapAngle((TAU * (lineTime - Date.now())) / cylCycleTime);
    return this._roundTheBack(angle);
  }

  _updateOldestTextLine() {
    // console.log("_updateOldestTextLine");
    const oldest = this._oldestTextLine();
    oldest.timeInMinutes += this.numMajorMarkers;
    const lineTime = oldest.timeInMinutes * 60 * 1000;

    const getTimeString = this._getTimeStringFn();
    const displayText = getTimeString(new Date(lineTime));
    oldest.displayText = displayText;

    // To calculate angle, consider that if the text was for 'now', it would be
    // displayed at 0° (i.e. front of the cylinder). So, we need to
    // subtract time 'now' from lineTime, calculate what that is as a proportion
    // of the cylinder circumference, and then add a pro rata of 360°.
    // We also need to take account of the fact the cylinder is rotating.
    const cylCycleTime = this.numMajorMarkers * 60 * 1000;
    const angle = wrapAngle(
      (TAU * (lineTime - Date.now())) / cylCycleTime -
        this.cylinderGroup.rotation.x
    );

    this._requestCreateTextGeom(oldest, angle);
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
        const angle = HALF_PI * (1 - i / bevelSegments);
        points.push(
          new THREE.Vector2(
            topBevelCenter.x + b * Math.cos(angle),
            topBevelCenter.y + b * Math.sin(angle)
          )
        );
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
        const angle = -HALF_PI * (i / bevelSegments);
        points.push(
          new THREE.Vector2(
            bottomBevelCenter.x + b * Math.cos(angle),
            bottomBevelCenter.y + b * Math.sin(angle)
          )
        );
      }
    }

    // Add the final points to close the profile at the bottom-center
    points.push(new THREE.Vector2(p5.x, p5.y));
    //points.push(new THREE.Vector2(p6.x, p6.y));

    return points.reverse(); // We actually want the y coords going up
  }

  _requestCreateTextGeom(textLine, angle) {
    const msg = {
      type: "generate",
      payload: {
        timeInMinutes: textLine.timeInMinutes,
        displayText: textLine.displayText,
        textSize: this.textSize,
        textDepth: this.textDepth,
        baseCurveSegments: this.baseCurveSegments,
        cylDiameter: this.cylDiameter,
        angle: angle,
      },
    };
    // console.log("Posting msg:", msg);
    this.textGeometryWorker.postMessage(msg);
  }

  _onResize(width, height, pixelRatio) {
    this.pixelRatio = pixelRatio;
    if (!this.isRunning || !this.renderer || !this.camera) {
      return;
    }

    // ## Maintain Camera Perspective ##

    // To ensure the rendered view is simply a magnified version of a smaller view,
    // we need to make sure that the visible area of the scene at a given distance
    // from the camera remains constant. In Three.js, the PerspectiveCamera's
    // vertical field of view (fov) and the canvas's aspect ratio determine what
    // is visible.
    // So we need to adjust the fov based on the canvas height.

    // The desired visible height of the scene at the camera's z-position.
    let visibleHeight = this.sceneHeight;
    const ctAspectRatio = width / height;
    const sceneAspectRatio = this.sceneWidth / this.sceneHeight;
    if (ctAspectRatio < sceneAspectRatio) {
      visibleHeight *= sceneAspectRatio / ctAspectRatio;
    }

    const fov = 2 * Math.atan(visibleHeight / (2 * this.camera.position.z));
    this.camera.fov = MathUtils.radToDeg(fov);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix(); // crucial after changing camera parameters!

    // ## Optimal Detail ##
    this.renderer.setSize(
      Math.floor(width * this.pixelRatio),
      Math.floor(height * this.pixelRatio),
      false
    );
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
      // Cylinder spins 'upwards' on its horizontal axis.
      // If numMajorMarkers is (e.g.) 5 then the cylinder should rotate once every 5 minutes.
      const cycleDuration = this.numMajorMarkers * 60 * 1000;
      const progress = (timestamp % cycleDuration) / cycleDuration;
      this.cylinderGroup.rotation.x = wrapAngle(-TAU * progress);

      // The first render() can take over 250ms (which causes Chrome to issue a warning), so schedule for later.
      setTimeout(() => {
        if (this.renderer) this.renderer.render(this.scene, this.camera);
      }, 0);
    }

    this.animationFrameId = self.requestAnimationFrame(this._animationLoop);
  }

  destroy() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.animationFrameId) {
      self.cancelAnimationFrame(this.animationFrameId);
    }

    if (this.scene) {
      this.redIndexLines.forEach((line) => {
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
        this.scene.remove(line);
      });

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
      this.scene.clear();
    }

    for (const tex of Object.values(this.textures || {})) {
      if (tex) tex.dispose();
    }

    this.font = null;

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.textGeometryWorker) {
      this.textGeometryWorker.terminate();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cylinderGroup = null;
    this.textures = null;
    this.textLines = [];
    this.options = null;
  }
}

const renderer = new CylinderClockRenderer();

self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case "init":
      renderer
        .init(
          payload.canvas,
          payload.options,
          payload.width,
          payload.height,
          payload.pixelRatio
        )
        .catch((err) =>
          console.error("Error initializing renderer in worker:", err)
        );
      break;
    case "resize":
      renderer._onResize(payload.width, payload.height, payload.pixelRatio);
      break;
    case "destroy":
      renderer.destroy();
      self.close();
      break;
  }
};
