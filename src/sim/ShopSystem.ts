import type { BreachBoard } from './BreachBoard';
import type { HeroState } from './CombatSystem';
import { isOccupied, LOCKED, withoutFlag } from './CellBits';
import { shrinkStaticCore } from './CoreGrowthSystem';

export enum ShopItemId {
  HealthPotion = 'health-potion',
  FrontlineShield = 'frontline-shield',
  TeamShield = 'team-shield',
  CoreStabilizer = 'core-stabilizer',
  RerollQueue = 'reroll-queue',
  BombRadius1 = 'bomb-radius-1',
  CleanseLock = 'cleanse-lock',
  ExtraMove = 'extra-move'
}

export type ShopItemDefinition = {
  id: ShopItemId;
  name: string;
  cost: number;
  description: string;
  requiresTarget?: 'hero' | 'cell';
};

export type ShopRunApi = {
  points: number;
  heroes: HeroState[];
  board: BreachBoard;
  frontlineIndex: number;
  selectedCellIndex: number;
  extraMovesNextTurn: number;
  blockQueue: { rerollNext(): void; rerollAll(): void };
  clearRadius1(index: number): number;
  resolveBoardAfterManualDestruction(): void;
  addLog(message: string): void;
};

export function tryBuyShopItem(run: ShopRunApi, item: ShopItemDefinition, target = run.selectedCellIndex): boolean {
  if (run.points < item.cost) return false;
  const message = applyShopItem(run, item, target);
  if (!message) return false;
  run.points -= item.cost;
  run.addLog(message);
  return true;
}

function applyShopItem(run: ShopRunApi, item: ShopItemDefinition, target: number): string | null {
  switch (item.id) {
    case ShopItemId.HealthPotion: {
      const hero = run.heroes[target >= 0 && target < run.heroes.length ? target : run.frontlineIndex];
      if (!hero || hero.hp <= 0) return null;
      hero.hp = Math.min(hero.maxHp, hero.hp + 45);
      return `${hero.name} drank a bodega health potion.`;
    }
    case ShopItemId.FrontlineShield: {
      const hero = run.heroes[run.frontlineIndex];
      if (!hero || hero.hp <= 0) return null;
      hero.shield += 55;
      return `${hero.name} gained a dirty ward.`;
    }
    case ShopItemId.TeamShield: {
      for (const hero of run.heroes) if (hero.hp > 0) hero.shield += 25;
      return 'The whole crew gained cracked mirror shields.';
    }
    case ShopItemId.CoreStabilizer: {
      const result = shrinkStaticCore(run.board, 1);
      return `Core stabilized ${result.oldRadius} -> ${result.newRadius}.`;
    }
    case ShopItemId.RerollQueue: {
      run.blockQueue.rerollAll();
      return 'Block queue rerolled.';
    }
    case ShopItemId.BombRadius1: {
      if (target < 0) return null;
      const removed = run.clearRadius1(target);
      run.resolveBoardAfterManualDestruction();
      return `Contraband breach bomb removed ${removed} blocks.`;
    }
    case ShopItemId.CleanseLock: {
      if (target < 0 || target >= run.board.cellCount) return null;
      const cell = run.board.cells[target];
      if (!isOccupied(cell) || (cell & LOCKED) === 0) return null;
      run.board.cells[target] = withoutFlag(cell, LOCKED);
      return 'Static lock cleansed from selected cell.';
    }
    case ShopItemId.ExtraMove: {
      run.extraMovesNextTurn += 1;
      return '+1 move added to next turn.';
    }
    default: return null;
  }
}
