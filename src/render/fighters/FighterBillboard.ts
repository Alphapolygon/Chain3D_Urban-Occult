// src/render/fighters/FighterBillboard.ts
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import type { EnemyState, HeroState } from '../../sim/CombatSystem';
import { colorToCss } from '../../sim/CellBits';

type FighterKind = 'hero' | 'enemy';
type SyncOptions = { attackTimerText?: string; showAp?: boolean; ready?: boolean; };

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
  private visible = true;

  constructor(scene: THREE.Scene, position: THREE.Vector3, isEnemy = false) {
    this.kind = isEnemy ? 'enemy' : 'hero';
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.basePosition.copy(position);
    scene.add(this.group);

    this.domSprite = document.createElement('img');
    this.domSprite.className = isEnemy ? 'fighter-dom-sprite enemy' : 'fighter-dom-sprite hero';
    this.domSprite.draggable = false;
    this.domSprite.style.display = 'none';
    
    // FORCE FIXED SIZE INLINE: This guarantees both heroes and enemies are the exact same height!
    this.domSprite.style.height = '260px'; 
    document.body.appendChild(this.domSprite);

    this.domHud = document.createElement('div');
    this.domHud.className = `fighter-world-hud ${isEnemy ? 'enemy' : 'hero'}`;
    this.domHud.innerHTML = `
      <div class="hud-header"><span class="hud-name"></span></div>
      <div class="hud-bar hp-bar"><div class="fill hp-fill"></div></div>
      <div class="hud-bar ap-bar"><div class="fill ap-fill"></div></div>
      <div class="hud-timer"></div>
    `;
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

  syncState(fighter: HeroState | EnemyState, isFrontline: boolean, camera: THREE.Camera, options: SyncOptions = {}): void {
    const alive = fighter.hp > 0;
    const color = 'color' in fighter ? colorToCss(fighter.color) : '#ff42d0';
    const ready = !!options.ready;

    if (fighter.spriteUrl && fighter.spriteUrl !== this.domSpriteUrl) {
      this.domSprite.src = fighter.spriteUrl;
      this.domSpriteUrl = fighter.spriteUrl;
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

  triggerHit(intensity: number): void {
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
  }

  getScreenAnchor(camera: THREE.Camera, canvas: HTMLCanvasElement, yOffset = 4): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const p = this.group.position.clone();
    p.y += yOffset;
    p.project(camera);
    return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height };
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

    // MATCH HUD OFFSET TO THE FORCED 260px SPRITE HEIGHT
    const headOffset = 260; 
    this.domHud.style.left = `${x}px`;
    this.domHud.style.top = `${y - headOffset}px`;
    this.domHud.style.zIndex = (zIndex + 1).toString();
  }
}