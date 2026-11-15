// Small WebGL2 helpers shared by the landing page's two renderers (space scene and lunar surface).

export const FULLSCREEN_VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader failed to compile: ${gl.getShaderInfoLog(shader) ?? "unknown reason"}`);
  }
  return shader;
}

/** Builds a GPU program that runs `fragmentSource` once for every pixel of the canvas. */
export function buildFullscreenProgram(gl: WebGL2RenderingContext, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create a GPU program");
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`GPU program failed to link: ${gl.getProgramInfoLog(program) ?? "unknown reason"}`);
  }
  return program;
}

/** Two triangles covering the whole canvas, bound to attribute 0 (see buildFullscreenProgram). */
export function createFullscreenQuad(gl: WebGL2RenderingContext): WebGLBuffer {
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return quad;
}

/**
 * Creates a texture on the given unit that starts as one grey pixel (so drawing can begin at once)
 * and is replaced by the image at `url` when it has downloaded. Meant for world maps wrapped on a
 * globe: longitude repeats, latitude does not.
 *
 * The picture is decoded with `createImageBitmap`, which happens off the main thread; decoding a
 * several-megapixel map on the main thread used to stall every animation for a noticeable moment.
 */
export function loadGlobeTexture(
  gl: WebGL2RenderingContext,
  unit: number,
  url: string,
): { texture: WebGLTexture; loaded: Promise<void> } {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([90, 90, 90, 255]));

  const upload = (source: ImageBitmap | HTMLImageElement) => {
    // The renderer may have been disposed while the image was downloading.
    if (gl.isContextLost() || !gl.isTexture(texture)) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // image row 0 is north; GPU row 0 is the bottom
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };

  const loaded = new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error(`Could not load the image map ${url}`));
    // Preferred path: fetch + createImageBitmap decodes the picture off the main thread.
    if (typeof createImageBitmap === "function") {
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        })
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          upload(bitmap);
          bitmap.close();
          resolve();
        })
        .catch(fail);
      return;
    }
    // Older browsers: an <img> decodes on the main thread, but at least it loads.
    const image = new Image();
    image.onload = () => {
      upload(image);
      resolve();
    };
    image.onerror = fail;
    image.src = url;
  });
  return { texture, loaded };
}

/** What the animation hook needs from a renderer, whatever it draws. */
export type CanvasRenderer<Scene> = {
  /** Matches the drawing buffer to the canvas's on-screen size; returns that size in CSS pixels. */
  resize(): { widthPx: number; heightPx: number };
  render(scene: Scene): void;
  /** Resolves when everything needed for a complete picture has loaded. */
  ready: Promise<void>;
  dispose(): void;
};
