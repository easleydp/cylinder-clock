import * as THREE from "three";
import { MathUtils } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RectAreaLightHelper } from "three/addons/helpers/RectAreaLightHelper.js";
// import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "dat.gui";

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

    // The number of major markers (minute markers) that are rendered around the circumference.
    this.numMajorMarkers = 5;
    // The of minor markers rendered between each adjacent pair of major (minute) markers. So
    // a value of 11 gives 5 second gaps (60 / (11 + 1)).
    this.numMinorMarkersBetweenMajor = 11;

    // Text config
    this.textSize = 1;
    this.textDepth = 0.1;
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

  async _init() {
    if (this.isRunning) return;
    this.isRunning = true;

    // OffscreenCanvas can be used to improve performance by moving rendering to a worker.
    // Here, we're using it on the main thread, which is fine, but the primary benefit
    // is not realized without a worker.
    const canvasEl = document.createElement("canvas");
    this.targetElement.innerHTML = ""; // Clear existing content, if any
    this.targetElement.appendChild(canvasEl);

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
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: true,
    });
    // renderer size set in onResize

    // ## Lighting ##
    this._createLighting(this.scene);

    // ## Cylinder Creation ##
    this.cylinderGroup = new THREE.Group();
    this.scene.add(this.cylinderGroup);
    await this._createCylinder();
    this._createMarkersAndText();
    this._createRedIndexLines();

    // ## Responsive Resizing ##
    this._onResize = this._onResize.bind(this);
    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(this.targetElement);

    // Initial resize call to set everything up.
    this._onResize();

    // Start animation
    this._animationLoop = this._animationLoop.bind(this);
    this.animationFrameId = window.requestAnimationFrame(this._animationLoop);

    // Once a minute we'll update the oldest text line (while it's hidden round
    // the back of the cylinder). Skip first call if < 10 seconds from now.
    let firstCall = true;
    const loop = () => {
      const now = new Date();
      const msUntilNextMinute =
        60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      setTimeout(() => {
        if (!firstCall || msUntilNextMinute > 10 * 1000)
          this._updateOldestTextLine();
        firstCall = false;
        loop();
      }, msUntilNextMinute);
    };
    loop();
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
    const rectLight = new THREE.RectAreaLight(0xffffff, 30, 50, 4);
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

    const direcLightTop = new THREE.DirectionalLight(0xffffff, 0.25);
    direcLightTop.position.set(1.2, 4.0, -1.0);
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
   * Loads font for cylinder.
   * @returns Promise that resolves to a font.
   */
  async _loadFont() {
    const loader = new FontLoader();
    // TODO: It's generally better to host font files locally with your
    // project to avoid issues with external dependencies.
    const path =
      "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json";
    return new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, (err) => {
        reject(new Error(`Failed to load font from ${path}: ${err.message}`));
      });
    });
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
    const promises = Object.entries(fileTails).map(([key, fileTail]) => {
      return new Promise((resolve, reject) => {
        if (!fileTail) {
          resolve([key, null]);
          return;
        }
        const path = `./assets/textures/${folder}/${fileStem}${fileTail}`;
        loader.load(
          path,
          (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2, 2);
            resolve([key, tex]);
          },
          undefined,
          (err) => {
            reject(new Error(`Failed to load texture ${path}: ${err.message}`));
          }
        );
      });
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

    const [textures, font] = await Promise.all([
      this._loadTextures(),
      this._loadFont(),
    ]);
    this.textures = textures;
    this.font = font;

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
    mesh.rotation.z = HALF_PI;
    this.cylinderGroup.add(mesh);
  }

  _createRedIndexLines() {
    const points = [];
    const pencilLength = this.minorMarkerAxialWidth * 0.8;
    const pencilRadius = 0.02;
    points.push(new THREE.Vector2(0, 0)); // Tip
    points.push(new THREE.Vector2(pencilRadius, pencilLength * 0.2));
    points.push(new THREE.Vector2(pencilRadius, pencilLength));
    points.push(new THREE.Vector2(0, pencilLength));

    const geometry = new THREE.LatheGeometry(points, 12);
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.options.redLineColor),
      transmission: 1.0,
      roughness: 0.1,
      metalness: 0.0,
      ior: 1.5,
      transparent: true,
      opacity: 0.7,
    });

    const lineLeft = new THREE.Mesh(geometry, material);
    const lineRight = new THREE.Mesh(geometry, material);

    const y = this.cylDiameter / 2 + 0.1;
    const x = this.cylAxialLength / 2 - this.markerEndBuffer;

    lineLeft.position.set(-x, y, 0);
    lineLeft.rotation.z = Math.PI;

    lineRight.position.set(x, y, 0);

    this.scene.add(lineLeft, lineRight);
    this.redIndexLines = [lineLeft, lineRight];
  }

  _createMarkersAndText() {
    const numMajorMarkers = this.numMajorMarkers;
    const totalMarkersPerEnd =
      numMajorMarkers * (1 + this.numMinorMarkersBetweenMajor);
    const baseAngleIncrement = TAU / totalMarkersPerEnd;

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
    const progress = (timeNow % oneMinute) / oneMinute; // Climbs from 0.0 to (<) 1.0 every minute

    const angleOffset =
      // An initial 90° offset to make front 0°
      HALF_PI -
      // Extra offset to shift the latest minute to somewhere between 0° and 360°/numMajorMarkers
      (progress * TAU) / numMajorMarkers;

    // TODO: Use this instead of the one recreated in the loop
    // const material = new THREE.MeshStandardMaterial({
    //   color: 0x666666,
    //   metalness: 0.4,
    //   roughness: 0.4,
    // });

    markerXPositions.forEach((markerCenterX) => {
      for (let i = 0, j = 0; i < totalMarkersPerEnd; i++) {
        const isMajor = i % (this.numMinorMarkersBetweenMajor + 1) === 0;

        const axialWidth = isMajor
          ? this.majorMarkerAxialWidth
          : this.minorMarkerAxialWidth;
        const radialHeight = isMajor
          ? this.markerRadialHeight
          : this.markerRadialHeight / 4;
        const circumferentialLength = isMajor
          ? this.majorMarkerCircumferentialLength
          : this.minorMarkerCircumferentialLength;

        const markerCenterAngle = wrapAngle(
          i * baseAngleIncrement + angleOffset
        );

        const markerGeom = this._createDeformedMarkerGeometry(
          axialWidth,
          radialHeight,
          circumferentialLength,
          this.cylDiameter / 2,
          markerCenterX,
          markerCenterAngle
        );
        // TODO: remove temp debug colours (restore 0x666666 below)
        const color =
          i === 0
            ? 0xff0000
            : i === 12
            ? 0x00ff00
            : i === 24
            ? 0x0000ff
            : i === 36
            ? 0xcccccc
            : 0x666666;
        const material = new THREE.MeshStandardMaterial({
          color: color, //0x666666,
          metalness: 0.4,
          roughness: 0.4,
        });
        const marker = new THREE.Mesh(markerGeom, material);
        this.cylinderGroup.add(marker);

        // # Add text #
        if (isMajor && markerCenterX > 0) {
          // Assuming 5 major/minute markers:
          // For the 1st marker we want to display time now (t).
          // For the 2nd marker we want to display time 1 minute hence (t+1).
          // For the 3rd marker we want to display time 2 minutes hence (t+2).
          // For the 4th marker we want to display time 2 minutes ago (t-2).
          // For the 5th marker we want to display time 1 minute ago (t-1).
          const offsetMinutes =
            j < numMajorMarkers / 2 ? j : j - numMajorMarkers;
          const timeNowToLastMinute = Math.floor(timeNow / (1000 * 60));
          const timeInMinutes = timeNowToLastMinute + offsetMinutes;
          const displayText = getTimeString(
            new Date(timeInMinutes * 60 * 1000)
          );

          const textGeom = this._createTextGeom(markerCenterAngle, displayText);
          const mesh = new THREE.Mesh(textGeom, material);
          textLines.push({
            mesh,
            timeInMinutes,
            displayText, // Just for diag purposes
          });
          this.cylinderGroup.add(mesh);
          j++;
        }
      }
    });
  }

  _updateOldestTextLine() {
    const line = this.textLines.reduce((minItem, currentItem) =>
      currentItem.timeInMinutes < minItem.timeInMinutes ? currentItem : minItem
    );
    line.timeInMinutes += this.numMajorMarkers;
    const lineTime = line.timeInMinutes * 60 * 1000;

    const getTimeString = this._getTimeStringFn();
    const displayText = getTimeString(new Date(lineTime));
    line.displayText = displayText;

    // To calculate angle, consider that if the text was for 'now', it would be
    // displayed at 90° (0° being the 'top' of the cylinder). So, we need to
    // subtract time 'now' from lineTime, calculate what that is as a proportion
    // of the cylinder circumference, and then add a pro-rata of 360° to 90°.
    // We also need to take account of the fact the cylinder is rotating.
    const timeNow = Date.now();
    const cylCycleTime = this.numMajorMarkers * 60 * 1000; // e.g. 5 minutes (in ms)
    const angle = wrapAngle(
      HALF_PI +
        (TAU * (lineTime - timeNow)) / cylCycleTime -
        this.cylinderGroup.rotation.x
    );

    line.mesh.geometry.dispose();
    console.time(`_createTextGeom "${displayText}"`);
    line.mesh.geometry = this._createTextGeom(angle, displayText);
    console.timeEnd(`_createTextGeom "${displayText}"`);
  }

  _createTextGeom(angle, displayText) {
    const geometryParams = {
      font: this.font,
      size: this.textSize,
      depth: this.textDepth,
      curveSegments: this.baseCurveSegments,
      bevelEnabled: false,
    };
    let textGeo = new TextGeometry(displayText, geometryParams);

    const tessellateModifier = new TessellateModifier(
      this.textSize / 24, // maxEdgeLength: e.g., textSize / 5 or a fixed value like 0.4. Adjust as needed.
      // Smaller values = more detail = more polygons.
      12 // maxIterations: How many times to repeat the subdivision. Default is often fine.
    );
    // const tessellateModifier = new TessellateModifier(
    //   this.textSize / 12, // maxEdgeLength: e.g., textSize / 5 or a fixed value like 0.4. Adjust as needed.
    //   // Smaller values = more detail = more polygons.
    //   4 // maxIterations: How many times to repeat the subdivision. Default is often fine.
    // );
    textGeo = tessellateModifier.modify(textGeo);
    textGeo.computeBoundingBox();
    const textBoundingBox = textGeo.boundingBox;
    const textWidth = textBoundingBox.max.x - textBoundingBox.min.x;
    const textHeight = textBoundingBox.max.y - textBoundingBox.min.y;

    const positions = textGeo.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      const idx = i * 3;
      const originalX = positions[idx],
        originalY = positions[idx + 1],
        originalZ = positions[idx + 2];

      // Map text's X to cylinder's length (world X-axis), centred
      const mappedX = originalX - textBoundingBox.min.x - textWidth / 2;

      // Map text's Y (height) and Z (extrusion) to cylinder's curved surface (YZ plane)
      const cylRadius = this.cylDiameter / 2;
      const verticalOffsetInText =
        originalY - textBoundingBox.min.y - textHeight / 2;
      const angleOffsetForCharHeight = verticalOffsetInText / cylRadius;
      const currentWrappedAngle = angle - angleOffsetForCharHeight;
      const effectiveRadius = cylRadius + originalZ; // originalZ is extrusion depth from TextGeometry

      positions[idx] = mappedX;
      positions[idx + 1] = effectiveRadius * Math.cos(currentWrappedAngle);
      positions[idx + 2] = effectiveRadius * Math.sin(currentWrappedAngle);
    }
    textGeo.attributes.position.needsUpdate = true;
    textGeo.computeVertexNormals();
    return textGeo;
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
    camera.fov = MathUtils.radToDeg(fov);
    camera.aspect = width / height;
    camera.updateProjectionMatrix(); // crucial after changing camera parameters!

    // ## Optimal Detail ##
    const pixelRatio = window.devicePixelRatio;
    renderer.setSize(
      Math.floor(width * pixelRatio),
      Math.floor(height * pixelRatio),
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
      if (this.cylinderGroup) {
        // Cylinder spins 'upwards' on its horizontal axis.
        // If numMajorMarkers is (e.g.) 5 then the cylinder should rotate once every 5 minutes.
        const cycleDuration = this.numMajorMarkers * 60 * 1000;
        const progress = (timestamp % cycleDuration) / cycleDuration; // Climbs from 0.0 to (<) 1.0 every cycle
        this.cylinderGroup.rotation.x = wrapAngle(-TAU * progress);
      }

      // The first render() can take over 100ms (which causes Chrome to issue a warning), so schedule for later.
      setTimeout(() => {
        if (this.renderer) this.renderer.render(this.scene, this.camera);
      }, 0);
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

    if (this.targetElement) {
      this.targetElement.innerHTML = "";
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

export default CylinderClock;
