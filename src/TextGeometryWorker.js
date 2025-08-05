import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import fontJson from "./fonts/helvetiker_regular.typeface.json?raw";

let font = null;

function loadFont() {
  if (!font) {
    const loader = new FontLoader();
    font = loader.parse(JSON.parse(fontJson));
  }
}

function createTextGeom(
  displayText,
  textSize,
  textDepth,
  baseCurveSegments,
  cylDiameter,
  angle
) {
  const geometryParams = {
    font: font,
    size: textSize,
    depth: textDepth,
    curveSegments: baseCurveSegments,
    bevelEnabled: false,
  };
  let textGeo = new TextGeometry(displayText, geometryParams);

  const tessellateModifier = new TessellateModifier(
    textSize / 24, // maxEdgeLength: e.g., textSize / 5 or a fixed value like 0.4. Adjust as needed.
    // Smaller values = more detail = more polygons.
    12 // maxIterations: How many times to repeat the subdivision. Default is often fine.
  );
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
    const cylRadius = cylDiameter / 2;
    const verticalOffsetInText =
      originalY - textBoundingBox.min.y - textHeight / 2;
    const angleOffsetForCharHeight = verticalOffsetInText / cylRadius;
    const currentWrappedAngle = angle - angleOffsetForCharHeight;
    const effectiveRadius = cylRadius + originalZ;

    positions[idx] = mappedX;
    positions[idx + 1] = effectiveRadius * Math.cos(currentWrappedAngle);
    positions[idx + 2] = effectiveRadius * Math.sin(currentWrappedAngle);
  }
  textGeo.attributes.position.needsUpdate = true;
  textGeo.computeVertexNormals();
  return textGeo;
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === "generate") {
    try {
      loadFont();
      const {
        displayText,
        textSize,
        textDepth,
        baseCurveSegments,
        cylDiameter,
        angle,
      } = payload;
      const geometry = createTextGeom(
        displayText,
        textSize,
        textDepth,
        baseCurveSegments,
        cylDiameter,
        angle
      );

      const transferable = {
        position: geometry.attributes.position.array.buffer,
        normal: geometry.attributes.normal.array.buffer,
      };

      self.postMessage(
        {
          type: "geometry",
          payload: {
            geometry: transferable,
            originalPayload: payload,
          },
        },
        [transferable.position, transferable.normal]
      );
    } catch (error) {
      self.postMessage({
        type: "error",
        payload: { message: error.message, stack: error.stack },
      });
    }
  }
};
