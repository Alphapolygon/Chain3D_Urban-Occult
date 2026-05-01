import { isShopItemUnlocked } from './metaProgress';
import { ShopItemId, type ShopItemDefinition } from '../sim/ShopSystem';

export type ShopItemWithMeta = ShopItemDefinition & {
  unlockSource?: string;
  lockedByDefault?: boolean;
};

const BASE_SHOP_ITEMS: readonly ShopItemWithMeta[] = Object.freeze([
  { id: ShopItemId.HealthPotion, name: 'Health Potion', cost: 240, description: 'Restore 45 HP to target hero, or the Frontline hero by default.', requiresTarget: 'hero' },
  { id: ShopItemId.FrontlineShield, name: 'Frontline Shield', cost: 220, description: 'Add 55 shield to the current Frontline hero.' },
  { id: ShopItemId.TeamShield, name: 'Team Shield', cost: 420, description: 'Add 25 shield to every living hero.' },
  { id: ShopItemId.CoreStabilizer, name: 'Core Stabilizer', cost: 520, description: 'Shave one layer from the Static core.' },
  { id: ShopItemId.RerollQueue, name: 'Queue Reroll', cost: 120, description: 'Reroll the visible block queue.' },
  { id: ShopItemId.BombRadius1, name: 'Breach Bomb', cost: 380, description: 'Erase destructible blocks in radius 1 around selected cell.', requiresTarget: 'cell' },
  { id: ShopItemId.CleanseLock, name: 'Lock Cleanser', cost: 180, description: 'Remove Locked status from selected cell.', requiresTarget: 'cell' },
  { id: ShopItemId.ExtraMove, name: 'Borrowed Time', cost: 260, description: '+1 move next player turn.' }
]);

const META_SHOP_ITEMS: readonly ShopItemWithMeta[] = Object.freeze([
  { id: ShopItemId.CourierPatch, name: 'Courier Patch Kit', cost: 360, description: 'Unlocked by The Courier. Restore 24 HP to every living Cleaner.', lockedByDefault: true, unlockSource: 'courier' },
  { id: ShopItemId.SignalSpoof, name: 'Signal Spoof', cost: 340, description: 'Unlocked by The Hacker. Reroll the queue and bank +1 move.', lockedByDefault: true, unlockSource: 'hacker' },
  { id: ShopItemId.DoorWard, name: 'Door Ward', cost: 390, description: 'Unlocked by The Bouncer. Add 90 shield to the current Frontline hero.', lockedByDefault: true, unlockSource: 'bouncer' },
  { id: ShopItemId.SigilSpray, name: 'Sigil Spray', cost: 320, description: 'Unlocked by The Tagger. Add 18 AP to every living Cleaner.', lockedByDefault: true, unlockSource: 'tagger' },
  { id: ShopItemId.RemoteCharge, name: 'Remote Breach Charge', cost: 440, description: 'Unlocked by The Rigger. Radius-1 breach bomb plus +1 move next turn.', requiresTarget: 'cell', lockedByDefault: true, unlockSource: 'rigger' }
]);

export const SHOP_ITEMS: readonly ShopItemWithMeta[] = Object.freeze([...BASE_SHOP_ITEMS, ...META_SHOP_ITEMS]);

export function getAvailableShopItems(): ShopItemWithMeta[] {
  return SHOP_ITEMS.filter((item) => !item.lockedByDefault || isShopItemUnlocked(item.id));
}

export function getShopItem(id: ShopItemId): ShopItemDefinition | undefined {
  return SHOP_ITEMS.find((item) => item.id === id && (!item.lockedByDefault || isShopItemUnlocked(item.id)));
}
