// src/render/fighters/FighterBillboard.ts
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import type { EnemyState, FighterAnimationState, FighterSpriteSet, HeroState } from '../../sim/CombatSystem';
import { colorToCss } from '../../sim/CellBits';

type FighterKind = 'hero' | 'enemy';
type SyncOptions = { attackTimerText?: string; showAp?: boolean; ready?: boolean; };

type SpriteCapableFighter = (HeroState | EnemyState) & {
  sprites?: FighterSpriteSet;
  spriteUrl?: string;
  attackSpriteUrl?: string;
  hitSpriteUrl?: string;
  dieSpriteUrl?: string;
  specialSpriteUrl?: string;
};

function collectSprites(fighter: SpriteCapableFighter): FighterSpriteSet {
  return {
    ...fighter.sprites,
    idle: fighter.sprites?.idle ?? fighter.spriteUrl,
    attack: fighter.sprites?.attack ?? fighter.attackSpriteUrl,
    hit: fighter.sprites?.hit ?? fighter.hitSpriteUrl,
    die: fighter.sprites?.die ?? fighter.dieSpriteUrl,
    special: fighter.sprites?.special ?? fighter.specialSpriteUrl
  };
}

export class FighterBillboard {
  readonly group: THREE.Group;
  readonly kind: FighterKind;
  private readonly basePosition = new THREE.Vector3();
  private readonly domSprite: HTMLImageElement;

  private readonly domHud: HTMLDivElement;
  private readonly hpFillEl: HTMLDivElement;
  private readonly apFillEl: HTMLDivElement;
  private readonly nameEl: HTMLSpanElement;
  private readonly timerEl: HTMLDivElement;

  private domSpriteUrl = '';
  private forcedState: FighterAnimationState | null = null;
  private forcedUntil = 0;
  private sprites: FighterSpriteSet = {};
  private visible = true;
  private clickHandler: (() => void) | null = null;

  constructor(scene: THREE.Scene, position: THREE.Vector3, isEnemy = false) {
    this.kind = isEnemy ? 'enemy' : 'hero';
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.basePosition.copy(position);
    scene.add(this.group);

    this.domSprite = document.createElement('img');
    this.domSprite.className = isEnemy ? 'fighter-dom-sprite enemy state-idle' : 'fighter-dom-sprite hero state-idle';
    this.domSprite.draggable = false;
    this.domSprite.style.display = 'none';
    this.domSprite.style.height = isEnemy ? '330px' : '260px';
    this.domSprite.style.pointerEvents = 'auto';
    this.domSprite.style.cursor = 'pointer';
    this.domSprite.addEventListener('click', (event) => {
      event.stopPropagation();
      this.clickHandler?.();
    });
    document.body.appendChild(this.domSprite);

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

    this.nameEl = this.domHud.querySelector('.hud-name')!;
    this.hpFillEl = this.domHud.querySelector('.hp-fill')!;
    this.apFillEl = this.domHud.querySelector('.ap-fill')!;
    this.timerEl = this.domHud.querySelector('.hud-timer')!;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.domSprite.style.display = visible ? 'block' : 'none';
    this.domHud.style.display = visible ? 'block' : 'none';
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
    this.sprites = collectSprites(fighter as SpriteCapableFighter);

    if (alive) this.domSprite.classList.remove('death-pop');

    if (!alive) {
      this.forcedState = null;
      this.useSpriteState('die');
    } else if (this.forcedState && performance.now() < this.forcedUntil) {
      this.useSpriteState(this.forcedState);
    } else {
      this.forcedState = null;
      this.useSpriteState('idle');
    }

    this.domSprite.classList.toggle('ready', ready);
    this.domSprite.classList.toggle('down', !alive);
    this.domHud.style.opacity = alive ? '1' : '0.4';

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

    this.positionDomElements(camera);
  }

  triggerAttack(durationMs = 520): void {
    this.playTemporaryState('attack', durationMs);
    this.domSprite.classList.remove('attack-pop');
    void this.domSprite.offsetWidth;
    this.domSprite.classList.add('attack-pop');
    window.setTimeout(() => this.domSprite.classList.remove('attack-pop'), durationMs);
  }

  triggerSpecial(durationMs = 720): void {
    this.playTemporaryState('special', durationMs);
    this.domSprite.classList.remove('special-pop');
    void this.domSprite.offsetWidth;
    this.domSprite.classList.add('special-pop');
    window.setTimeout(() => this.domSprite.classList.remove('special-pop'), durationMs);
  }

  triggerDeath(): void {
    this.forcedState = null;
    this.useSpriteState('die');
    this.domSprite.classList.remove('death-pop');
    void this.domSprite.offsetWidth;
    this.domSprite.classList.add('death-pop');
  }

  triggerHit(intensity: number): void {
    this.playTemporaryState('hit', 450);

    const home = this.basePosition.clone();
    const offsetX = this.kind === 'enemy' ? intensity : -intensity;
    new TWEEN.Tween(this.group.position)
      .to({ x: home.x + offsetX, y: home.y + intensity * 0.28 }, 45)
      .easing(TWEEN.Easing.Quadratic.Out)
      .repeat(3)
      .yoyo(true)
      .onComplete(() => this.group.position.copy(home))
      .start();

    this.domSprite.classList.remove('hit-flash');
    void this.domSprite.offsetWidth;
    this.domSprite.classList.add('hit-flash');
    window.setTimeout(() => this.domSprite.classList.remove('hit-flash'), 320);
  }

  getScreenAnchor(camera: THREE.Camera, canvas: HTMLCanvasElement, yOffset = 4): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const p = this.group.position.clone();
    p.y += yOffset;
    p.project(camera);
    return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height };
  }

  private playTemporaryState(state: FighterAnimationState, durationMs: number): void {
    this.forcedState = state;
    this.forcedUntil = performance.now() + durationMs;
    this.useSpriteState(state, true);
  }

  private useSpriteState(state: FighterAnimationState, restart = false): void {
    const url = this.sprites[state] ?? this.sprites.idle ?? '';
    for (const key of ['idle', 'attack', 'hit', 'die', 'special'] as const) {
      this.domSprite.classList.toggle(`state-${key}`, key === state);
    }
    this.domSprite.dataset.state = state;

    if (!url) {
      this.domSprite.style.display = this.visible ? 'none' : 'none';
      return;
    }

    if (restart && url === this.domSpriteUrl) {
      this.domSprite.src = '';
      window.requestAnimationFrame(() => {
        this.domSprite.src = url;
      });
    } else if (url !== this.domSpriteUrl) {
      this.domSprite.src = url;
      this.domSpriteUrl = url;
    }

    this.domSprite.style.display = this.visible ? 'block' : 'none';
  }

  private positionDomElements(camera: THREE.Camera): void {
    const p = this.group.position.clone();
    p.project(camera);
    if (p.z < -1 || p.z > 1) {
      this.domSprite.style.display = 'none';
      this.domHud.style.display = 'none';
      return;
    }
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    const zIndex = Math.round((1 - p.z) * 10000);

    this.domSprite.style.left = `${x}px`;
    this.domSprite.style.top = `${y}px`;
    this.domSprite.style.zIndex = zIndex.toString();

    const headOffset = this.kind === 'enemy' ? 330 : 260;
    this.domHud.style.left = `${x}px`;
    this.domHud.style.top = `${y - headOffset}px`;
    this.domHud.style.zIndex = (zIndex + 1).toString();
  }
}
