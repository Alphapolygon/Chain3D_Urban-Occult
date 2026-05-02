import * as THREE from 'three';
import type { RunSnapshot } from '../../sim/RunState';
import { FighterBillboard } from './FighterBillboard';

const HERO_BASE_POSITIONS = [
  new THREE.Vector3(-19.0, -9.0, -3.0),
  new THREE.Vector3(-16.0, -9.0, 0.0),
  new THREE.Vector3(-13.0, -9.0, 3.0)
] as const;

const ENEMY_BASE_POSITION = new THREE.Vector3(13.0, -9.0, 0.0);

export class FighterStage {
  readonly heroes: FighterBillboard[];
  readonly enemy: FighterBillboard;

  constructor(scene: THREE.Scene) {
    this.heroes = HERO_BASE_POSITIONS.map((position) => new FighterBillboard(scene, position, false));
    this.enemy = new FighterBillboard(scene, ENEMY_BASE_POSITION, true);
  }

  setHeroClickHandler(handler: (index: number) => void): void {
    this.heroes.forEach((billboard, index) => billboard.setClickHandler(() => handler(index)));
  }

  setEnemyClickHandler(handler: () => void): void {
    this.enemy.setClickHandler(handler);
  }

  setVisible(visible: boolean): void {
    for (const billboard of this.heroes) billboard.setVisible(visible);
    this.enemy.setVisible(visible);
  }

  sync(snapshot: RunSnapshot, gameStarted: boolean, camera: THREE.Camera): void {
    this.setVisible(gameStarted);
    if (!gameStarted) return;

    for (let i = 0; i < this.heroes.length; i++) {
      const hero = snapshot.heroes[i];
      const billboard = this.heroes[i];
      if (!hero) {
        billboard.setVisible(false);
        continue;
      }

      const isFrontline = i === snapshot.frontlineIndex;
      const target = HERO_BASE_POSITIONS[i].clone();
      if (isFrontline) {
        target.x = -9.5;
        target.z = 2.0;
      }

      billboard.setVisible(true);
      billboard.setBasePosition(target);
      billboard.group.position.lerp(target, 0.14);
      billboard.syncState(hero, isFrontline, camera, {
        showAp: true,
        ready: hero.hp > 0 && hero.ap >= hero.maxAp,
        attackTimerText: hero.hp > 0 && hero.ap >= hero.maxAp ? 'SPECIAL READY' : ''
      });
    }

    this.enemy.setBasePosition(ENEMY_BASE_POSITION);
    this.enemy.group.position.lerp(ENEMY_BASE_POSITION, 0.08);
    this.enemy.syncState(snapshot.enemy, false, camera, {
      showAp: false,
      attackTimerText: enemyTimerText(snapshot)
    });
  }
}

function enemyTimerText(snapshot: RunSnapshot): string {
  if (snapshot.phase === 'enemy-turn') return 'ATTACK INCOMING';
  if (snapshot.phase === 'ko') return 'BANISHED';
  return `ATTACKS IN ${snapshot.enemy.attackTimer} MOVES`;
}
