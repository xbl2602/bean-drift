// The radio links in the console backdrop, drawn in 3D: a thin glowing beam between two points,
// light pulses (a bright head with two fading tails) that travel along it, and ripples that spread
// from an antenna. Everything is additive, so it glows against the dark and costs almost nothing.

import type * as ThreeNamespace from "three";

type Three = typeof ThreeNamespace;

export type LinkStyle = { color: number; pulses: number; speed: number; headSize: number };

export type LinkTextures = { glow: ThreeNamespace.Texture; ring: ThreeNamespace.Texture };

/** A soft round glow and a thin ring, drawn once on a small canvas. */
export function createLinkTextures(THREE: Three): LinkTextures {
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const g = glowCanvas.getContext("2d")!;
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.18, "rgba(255,255,255,0.75)");
  glow.addColorStop(0.5, "rgba(255,255,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);

  const ringCanvas = document.createElement("canvas");
  ringCanvas.width = ringCanvas.height = 128;
  const r = ringCanvas.getContext("2d")!;
  r.strokeStyle = "rgba(255,255,255,0.95)";
  r.lineWidth = 3;
  r.shadowColor = "white";
  r.shadowBlur = 6;
  r.beginPath();
  r.arc(64, 64, 52, 0, Math.PI * 2);
  r.stroke();
  return { glow: new THREE.CanvasTexture(glowCanvas), ring: new THREE.CanvasTexture(ringCanvas) };
}

const BEAM_SEGMENTS = 24;

export class RadioLink {
  readonly group: ThreeNamespace.Group;
  private readonly line: ThreeNamespace.Line;
  private readonly linePositions: Float32Array;
  private readonly lineColors: Float32Array;
  private readonly lineMaterial: ThreeNamespace.LineBasicMaterial;
  private readonly pulseSprites: ThreeNamespace.Sprite[][] = [];
  private readonly rippleSprites: ThreeNamespace.Sprite[] = [];
  private readonly tmp: ThreeNamespace.Vector3;
  private readonly colorObject: ThreeNamespace.Color;

  constructor(private readonly THREE: Three, textures: LinkTextures, private readonly style: LinkStyle) {
    this.group = new THREE.Group();
    this.tmp = new THREE.Vector3();
    this.colorObject = new THREE.Color(style.color);
    this.linePositions = new Float32Array((BEAM_SEGMENTS + 1) * 3);
    this.lineColors = new Float32Array((BEAM_SEGMENTS + 1) * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.linePositions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.lineColors, 3));
    this.lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.line = new THREE.Line(geometry, this.lineMaterial);
    this.line.frustumCulled = false;
    this.group.add(this.line);

    for (let k = 0; k < style.pulses; k++) {
      const trio: ThreeNamespace.Sprite[] = [];
      for (let part = 0; part < 3; part++) {
        const material = new THREE.SpriteMaterial({ map: textures.glow, color: style.color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        sprite.visible = false;
        this.group.add(sprite);
        trio.push(sprite);
      }
      this.pulseSprites.push(trio);
    }
    for (let k = 0; k < 4; k++) {
      const material = new THREE.SpriteMaterial({ map: textures.ring, color: style.color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      this.group.add(sprite);
      this.rippleSprites.push(sprite);
    }
  }

  /** Redraws the link from `from` to `to`. `strength` (0..1) fades the whole thing in and out. */
  update(from: ThreeNamespace.Vector3, to: ThreeNamespace.Vector3, strength: number, timeS: number, phase = 0, reverse = false) {
    const visible = strength > 0.01;
    this.group.visible = visible;
    if (!visible) return;
    const { THREE } = this;
    const length = from.distanceTo(to) || 1;
    // The beam: brightest in the middle, fading to nothing at both ends.
    for (let i = 0; i <= BEAM_SEGMENTS; i++) {
      const t = i / BEAM_SEGMENTS;
      this.tmp.lerpVectors(from, to, t);
      this.linePositions.set([this.tmp.x, this.tmp.y, this.tmp.z], i * 3);
      const fade = Math.sin(Math.PI * t) ** 0.7 * 0.55 * strength;
      this.lineColors.set([this.colorObject.r * fade, this.colorObject.g * fade, this.colorObject.b * fade], i * 3);
    }
    this.line.geometry.getAttribute("position").needsUpdate = true;
    this.line.geometry.getAttribute("color").needsUpdate = true;

    const { pulses, speed, headSize } = this.style;
    for (let k = 0; k < pulses; k++) {
      const t = ((((timeS * speed) / length + k / pulses + phase) % 1) + 1) % 1;
      const along = reverse ? 1 - t : t;
      const edge = Math.min(1, t / 0.08) * Math.min(1, (1 - t) / 0.12);
      this.pulseSprites[k].forEach((sprite, part) => {
        const back = (part * headSize * 1.6) / length; // tails trail behind the head
        const s = Math.min(1, Math.max(0, along + (reverse ? back : -back)));
        sprite.position.lerpVectors(from, to, s);
        sprite.scale.setScalar(headSize * (part === 0 ? 1 : part === 1 ? 0.72 : 0.5));
        sprite.material.opacity = strength * edge * (part === 0 ? 1 : part === 1 ? 0.45 : 0.22);
        sprite.visible = edge > 0.02;
      });
    }
  }

  /** Rings that spread from `at`; two staggered rings per call. */
  ripple(index: number, at: ThreeNamespace.Vector3, strength: number, timeS: number, size: number, offset: number) {
    for (let k = 0; k < 2; k++) {
      const sprite = this.rippleSprites[index * 2 + k];
      if (!sprite) continue;
      const t = (timeS * 0.5 + offset + k * 0.5) % 1;
      sprite.visible = strength > 0.02;
      sprite.position.copy(at);
      sprite.scale.setScalar(0.2 + t * size);
      sprite.material.opacity = strength * 0.6 * (1 - t) * Math.min(1, t / 0.1);
    }
  }

  dispose() {
    this.line.geometry.dispose();
    this.lineMaterial.dispose();
    this.pulseSprites.flat().forEach((sprite) => sprite.material.dispose());
    this.rippleSprites.forEach((sprite) => sprite.material.dispose());
  }
}
