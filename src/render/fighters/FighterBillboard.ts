// src/render/fighters/FighterBillboard.ts
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';

import { MeshBasicNodeMaterial } from 'three/webgpu';
import { texture, uv, oneMinus, vec2, vec4 , smoothstep} from 'three/tsl';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { EnemyState, FighterAnimationState, HeroState } from '../../sim/CombatSystem';
import { colorToCss } from '../../sim/CellBits';

type FighterKind = 'hero' | 'enemy';
type SyncOptions = { attackTimerText?: string; showAp?: boolean; ready?: boolean; };
type FighterClipState = Extract<FighterAnimationState, 'idle' | 'attack' | 'hit' | 'die'>;

type FighterModelAsset = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
};

const RTT_SIZE = 256;

// NEW: Global cache so we never load the same model twice!
const modelCache: Record<string, Promise<FighterModelAsset>> = {};

function loadFighterModel(url: string): Promise<FighterModelAsset> {
  if (!modelCache[url]) {
    modelCache[url] = new GLTFLoader().loadAsync(url).then((gltf: GLTF) => ({
      scene: gltf.scene,
      animations: gltf.animations
    }));
  }
  return modelCache[url];
}

export class FighterBillboard {
  readonly group: THREE.Group;
  readonly kind: FighterKind;

  private readonly basePosition = new THREE.Vector3();
  private readonly hiddenScene = new THREE.Scene();
  // FIXED: Tightly cropped orthographic camera so feet touch the floor
  private readonly hiddenCamera = new THREE.OrthographicCamera(-2.75, 2.75, 2.75, -2.75, 0.1, 20);
  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly billboardMesh: THREE.Mesh<THREE.PlaneGeometry, any>;
  private readonly dummyFighter: THREE.Mesh;
  private readonly domHud: HTMLDivElement;
  private readonly hitArea: HTMLDivElement;
  private readonly hpFillEl: HTMLDivElement;
  private readonly apFillEl: HTMLDivElement;
  private readonly nameEl: HTMLSpanElement;
  private readonly timerEl: HTMLDivElement;

  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<FighterClipState, THREE.AnimationAction>> = {};
  private currentAction: THREE.AnimationAction | null = null;
  private currentClipState: FighterClipState = 'idle';
  private modelRoot: THREE.Object3D | null = null;
  private modelReady = false;
  private modelFailed = false;
  private visible = true;
  private alive = true;
  private lastRenderTime = performance.now();
  private clickHandler: (() => void) | null = null;

  private readonly reflectionMesh: THREE.Mesh;

  // NEW: Dynamic Model Tracking
  private currentModelUrl?: string;
  private clipIndices?: { idle: number; attack: number; hit: number; die: number; };

  constructor(scene: THREE.Scene, position: THREE.Vector3, isEnemy = false) {
    this.kind = isEnemy ? 'enemy' : 'hero';
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.basePosition.copy(position);
    scene.add(this.group);

    this.hiddenScene.background = null;
    // FIXED: Camera bottom edge aligned to Y: 0
    this.hiddenCamera.position.set(0, 2.75, 10.0);
    this.hiddenCamera.lookAt(0, 2.75, 0);

    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(4, 7, 7);
    this.hiddenScene.add(key);
    const rim = new THREE.DirectionalLight(isEnemy ? 0xff42d0 : 0x27e7ff, 2.6);
    rim.position.set(-5, 4, 3);
    this.hiddenScene.add(rim);
    this.hiddenScene.add(new THREE.AmbientLight(0xffffff, 1.15));

    const dummyGeo = new THREE.BoxGeometry(3, 3, 3);
    const dummyMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0xff49d8 : 0x8dfcff,
      emissive: isEnemy ? 0x4a093a : 0x062f42,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.78
    });
    this.dummyFighter = new THREE.Mesh(dummyGeo, dummyMat);
    this.dummyFighter.position.y = 1.2;
    this.hiddenScene.add(this.dummyFighter);

    this.renderTarget = new THREE.WebGLRenderTarget(RTT_SIZE, RTT_SIZE, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false
    });
    this.renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
    this.renderTarget.texture.generateMipmaps = false;

// // FIXED: Clean geometry with NO scale hacks and shifted pivots!
    const planeSize = isEnemy ? 6.9 : 5.5;

    // 1. Main Billboard Geometry (Shift origin to the bottom edge)
    const mainGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    mainGeo.translate(0, (planeSize / 2) - 0.1, 0);

    // 2. Reflection Billboard Geometry (Shift origin to the top edge)
    const refGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    refGeo.translate(0, -(planeSize / 2) - 0.1, 0);

    // --- MAIN BILLBOARD (TSL) ---
    const mainMat = new MeshBasicNodeMaterial({
      transparent: true,
      alphaTest: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    // WebGPU RenderTargets flip Y, so we invert it here
    const mainUv = vec2(uv().x, oneMinus(uv().y));
    mainMat.colorNode = texture(this.renderTarget.texture, mainUv);

    this.billboardMesh = new THREE.Mesh(mainGeo, mainMat);
    // Keep position at 0, 0, 0 so it pivots perfectly around the feet!
    this.billboardMesh.renderOrder = 5;
    this.group.add(this.billboardMesh);

    // --- REFLECTION BILLBOARD (TSL) ---
    const refMat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    // Use standard UVs to project the texture upside down
    const refUv = vec2(uv().x, uv().y);
    const texNode = texture(this.renderTarget.texture, refUv);

    // 1. Pipe ONLY the RGB into the color node
    refMat.colorNode = texNode.rgb;

    // 2. THE FIX: Pipe the Alpha gradient explicitly into the opacity node!
    // uv().y is 1.0 at the top (feet), which becomes 55% opaque.
    // uv().y is 0.0 at the bottom (head), which becomes 0% opaque.
    const fade = oneMinus(smoothstep(1.0, 0.75, refUv.y));
    

    refMat.opacityNode = texNode.a.mul(fade).mul(0.055)
    this.reflectionMesh = new THREE.Mesh(refGeo, refMat);
    this.reflectionMesh.renderOrder = 4;
    this.group.add(this.reflectionMesh);

    // --- DOM UI SETUP ---
    this.domHud = document.createElement('div');
    this.domHud.className = `fighter-world-hud ${isEnemy ? 'enemy' : 'hero'}`;
    this.domHud.innerHTML = `
      <div class="hud-header"><span class="hud-name"></span></div>
      <div class="hud-bar hp-bar"><div class="fill hp-fill"></div></div>
      <div class="hud-bar ap-bar"><div class="fill ap-fill"></div></div>
      <div class="hud-timer"></div>
    `;
    this.domHud.style.pointerEvents = 'auto';
    this.domHud.style.cursor = 'pointer';
    this.domHud.addEventListener('click', (event) => {
      event.stopPropagation();
      this.clickHandler?.();
    });
    document.body.appendChild(this.domHud);

    this.hitArea = document.createElement('div');
    this.hitArea.className = `fighter-rtt-hit-area ${isEnemy ? 'enemy' : 'hero'}`;
    this.hitArea.style.position = 'fixed';
    this.hitArea.style.pointerEvents = 'auto';
    this.hitArea.style.cursor = 'pointer';
    this.hitArea.style.background = 'transparent';
    this.hitArea.addEventListener('click', (event) => {
      event.stopPropagation();
      this.clickHandler?.();
    });
    document.body.appendChild(this.hitArea);

    this.nameEl = this.domHud.querySelector('.hud-name')!;
    this.hpFillEl = this.domHud.querySelector('.hp-fill')!;
    this.apFillEl = this.domHud.querySelector('.ap-fill')!;
    this.timerEl = this.domHud.querySelector('.hud-timer')!;
  }

  renderHiddenStudio(renderer: any): void {
    if (!this.visible) return;

    const now = performance.now();
    const delta = Math.min(0.05, Math.max(0, (now - this.lastRenderTime) / 1000));
    this.lastRenderTime = now;

    if (this.mixer) this.mixer.update(delta);
    if (!this.modelReady || this.modelFailed) {
      this.dummyFighter.rotation.x += delta * 1.15;
      this.dummyFighter.rotation.y += delta * 1.75;
    }

    const previousTarget = renderer.getRenderTarget();
    const previousClearAlpha = renderer.getClearAlpha();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);

    renderer.setRenderTarget(this.renderTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    


    renderer.render(this.hiddenScene, this.hiddenCamera);
    
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.billboardMesh.visible = visible;
    this.reflectionMesh.visible = visible;
    this.domHud.style.display = visible ? 'block' : 'none';
    this.hitArea.style.display = visible ? 'block' : 'none';
  }

  setBasePosition(position: THREE.Vector3): void {
    this.basePosition.copy(position);
  }

  setClickHandler(handler: (() => void) | null): void {
    this.clickHandler = handler;
  }

  getPowerCollectWorldTarget(): THREE.Vector3 {
    return this.group.position.clone().add(new THREE.Vector3(0, this.kind === 'enemy' ? 6.2 : 4.8, 0));
  }

  syncState(fighter: HeroState | EnemyState, isFrontline: boolean, camera: THREE.Camera, options: SyncOptions = {}): void {
    const alive = fighter.hp > 0;
    const color = 'color' in fighter ? colorToCss(fighter.color) : '#ff42d0';
    const ready = !!options.ready;
    this.alive = alive;

    // NEW: Check for dynamic modelURL and update if it changes!
    const fighterData = fighter as any;
    if (fighterData.modelUrl && fighterData.modelUrl !== this.currentModelUrl) {
      this.currentModelUrl = fighterData.modelUrl;
      this.clipIndices = fighterData.clipIndices;
      this.loadModelIntoHiddenStudio(fighterData.modelUrl);
    }

    if (!alive && this.currentClipState !== 'die') this.playAnimation('die', false);
    if (alive && this.currentClipState === 'die') this.playAnimation('idle', true);

    this.dummyFighter.visible = !this.modelReady && alive;
    if (this.modelRoot) this.modelRoot.visible = alive || this.currentClipState === 'die';
    this.billboardMesh.material.opacity = alive ? 1.0 : 0.74;
    this.domHud.style.opacity = alive ? '1' : '0.4';
    this.hitArea.style.display = this.visible && alive ? 'block' : this.visible ? 'block' : 'none';

    const hpPct = Math.max(0, Math.min(1, fighter.maxHp > 0 ? fighter.hp / fighter.maxHp : 0));
    this.hpFillEl.style.width = `${hpPct * 100}%`;
    this.hpFillEl.style.background = alive ? '#ff375f' : '#686071';

    if ('ap' in fighter && options.showAp !== false) {
      const apPct = Math.max(0, Math.min(1, fighter.maxAp > 0 ? fighter.ap / fighter.maxAp : 0));
      this.apFillEl.style.width = `${apPct * 100}%`;
      this.apFillEl.parentElement!.style.display = 'block';
      this.apFillEl.style.background = ready ? '#ffe45e' : color;
    } else {
      this.apFillEl.parentElement!.style.display = 'none';
    }

    this.nameEl.textContent = `${fighter.name.toUpperCase()}  HP ${fighter.hp}/${fighter.maxHp}${isFrontline ? '  [FRONT]' : ''}`;
    this.nameEl.style.color = color;

    const timerText = options.attackTimerText ?? (ready ? 'SPECIAL READY' : '');
    this.timerEl.textContent = timerText;
    this.timerEl.style.display = timerText ? 'block' : 'none';
    this.timerEl.style.color = ready ? '#ffe45e' : '#ffffff';

    const targetScale = isFrontline ? 1.09 : 1.0;
    this.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.16);
    
    // FIXED: True 2D Sprite Billboarding (Perfectly parallel to camera glass)
    this.billboardMesh.quaternion.copy(camera.quaternion);
    this.reflectionMesh.quaternion.copy(camera.quaternion);
    
    this.positionDomElements(camera);
  }

  triggerAttack(durationMs = 520): void {
    if (!this.alive) return;
    this.playAnimation('attack', false);
    this.punchBillboard(1.14, durationMs);
  }

  triggerSpecial(durationMs = 720): void {
    if (!this.alive) return;
    this.playAnimation('attack', false);
    this.punchBillboard(1.23, durationMs);
  }

  triggerDeath(): void {
    this.alive = false;
    this.playAnimation('die', false);
  }

  triggerHit(intensity: number): void {
    if (this.alive) this.playAnimation('hit', false);

    const home = this.basePosition.clone();
    const offsetX = this.kind === 'enemy' ? intensity : -intensity;
    new TWEEN.Tween(this.group.position)
      .to({ x: home.x + offsetX, y: home.y + intensity * 0.28 }, 45)
      .easing(TWEEN.Easing.Quadratic.Out)
      .repeat(3)
      .yoyo(true)
      .onComplete(() => this.group.position.copy(home))
      .start();
  }

  getScreenAnchor(camera: THREE.Camera, canvas: HTMLCanvasElement, yOffset = 4): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const p = this.group.position.clone();
    p.y += yOffset;
    p.project(camera);
    return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height };
  }

  private async loadModelIntoHiddenStudio(url: string): Promise<void> {
    try {
      const asset = await loadFighterModel(url);
      if (!this.visible && !this.group.parent) return;

      // Clean up old model if the drafted character changes
      if (this.modelRoot) {
        this.hiddenScene.remove(this.modelRoot);
        this.mixer?.stopAllAction();
        this.mixer = null;
      }

      const model = cloneSkeleton(asset.scene);
      model.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.frustumCulled = false;
        child.castShadow = false;
        child.receiveShadow = false;
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => cloneAndTuneFighterMaterial(mat, this.kind));
        } else {
          child.material = cloneAndTuneFighterMaterial(child.material, this.kind);
        }
      });

      // FIXED: Wrap and Rotate so they fight from a Side-Profile!
      const wrapper = new THREE.Group();
      wrapper.add(model);

      normalizeModelForStudio(model, this.kind === 'enemy' ? 4.8 : 4.45);
      wrapper.rotation.y = this.kind === 'enemy' ? -Math.PI / 2 : Math.PI / 2;

      this.hiddenScene.add(wrapper);
      this.modelRoot = wrapper;
      this.dummyFighter.visible = false;
      this.modelReady = true;

      this.mixer = new THREE.AnimationMixer(model);
      this.actions = this.createActions(this.mixer, asset.animations);
      this.mixer.addEventListener('finished', (event) => {
        if (event.action !== this.currentAction) return;
        if (this.currentClipState !== 'die') this.playAnimation('idle', true);
      });
      this.playAnimation('idle', true);
    } catch (error) {
      console.warn(`Failed to load ${url}, using RTT dummy cube fallback.`, error);
      this.modelFailed = true;
      this.dummyFighter.visible = true;
    }
  }

  private playAnimation(state: FighterClipState, immediate = false): void {
    const action = this.actions[state];
    if (!action) {
      this.currentClipState = state;
      return;
    }

    const previous = this.currentAction;
    this.currentAction = action;
    this.currentClipState = state;

    action.reset();
    action.enabled = true;
    action.clampWhenFinished = state === 'die';
    action.setLoop(state === 'idle' ? THREE.LoopRepeat : THREE.LoopOnce, state === 'idle' ? Infinity : 1);
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);

    if (previous && previous !== action) {
      previous.fadeOut(immediate ? 0.02 : 0.12);
      action.fadeIn(immediate ? 0.02 : 0.12);
    }
    action.play();
  }

  private punchBillboard(scale: number, durationMs: number): void {
    new TWEEN.Tween(this.billboardMesh.scale)
      .to({ x: scale, y: scale, z: scale }, durationMs * 0.5)
      .easing(TWEEN.Easing.Quadratic.Out)
      .yoyo(true)
      .repeat(1)
      .start();

   new TWEEN.Tween(this.reflectionMesh.scale)
      .to({ x: scale, y: scale, z: scale }, durationMs * 0.5) 
      .easing(TWEEN.Easing.Quadratic.Out)
      .yoyo(true)
      .repeat(1)
      .start();
  }

  private positionDomElements(camera: THREE.Camera): void {
    const p = this.group.position.clone();
    p.project(camera);
    if (p.z < -1 || p.z > 1 || !this.visible) {
      this.domHud.style.display = 'none';
      this.hitArea.style.display = 'none';
      return;
    }

    this.domHud.style.display = 'block';
    this.hitArea.style.display = 'block';

    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    const zIndex = Math.round((1 - p.z) * 10000);
    const headOffset = this.kind === 'enemy' ? 310 : 260;

    this.domHud.style.left = `${x}px`;
    this.domHud.style.top = `${y - headOffset}px`;
    this.domHud.style.zIndex = (zIndex + 2).toString();

    const hitWidth = this.kind === 'enemy' ? 300 : 230;
    const hitHeight = this.kind === 'enemy' ? 360 : 275;
    const hitTopOffset = this.kind === 'enemy' ? 292 : 238;
    this.hitArea.style.left = `${x - hitWidth * 0.5}px`;
    this.hitArea.style.top = `${y - hitTopOffset}px`;
    this.hitArea.style.width = `${hitWidth}px`;
    this.hitArea.style.height = `${hitHeight}px`;
    this.hitArea.style.zIndex = (zIndex + 1).toString();
  }

  // --- NEW: Dynamic Clip Fetching ---
  private createActions(mixer: THREE.AnimationMixer, animations: readonly THREE.AnimationClip[]): Partial<Record<FighterClipState, THREE.AnimationAction>> {
    const actions: Partial<Record<FighterClipState, THREE.AnimationAction>> = {};
    for (const state of ['idle', 'attack', 'hit', 'die'] as const) {
      const clip = this.clipFor(animations, state);
      if (clip) actions[state] = mixer.clipAction(clip);
    }
    return actions;
  }

  private clipFor(animations: readonly THREE.AnimationClip[], state: FighterClipState): THREE.AnimationClip | null {
    if (!this.clipIndices) return animations[0] ?? null;
    return animations[this.clipIndices[state]] ?? animations[0] ?? null;
  }
}

function cloneAndTuneFighterMaterial(source: THREE.Material, kind: FighterKind): THREE.Material {
  const material = source.clone();
  if (material instanceof THREE.MeshStandardMaterial) {
    material.roughness = Math.min(material.roughness, 0.45);
    material.metalness = Math.max(material.metalness, 0.25);
    material.emissive = new THREE.Color(kind === 'enemy' ? '#3d0730' : '#061f35');
    material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.35);
  }
  return material;
}

function normalizeModelForStudio(model: THREE.Object3D, targetHeight: number): void {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const scale = size.y > 0 ? targetHeight / size.y : 1;
  model.scale.multiplyScalar(scale);
  model.position.x -= center.x * scale;
  model.position.z -= center.z * scale;
  model.position.y -= box.min.y * scale;
}