import { ShopItemId, type ShopItemDefinition } from '../sim/ShopSystem';

export const SHOP_ITEMS: readonly ShopItemDefinition[] = Object.freeze([
  { id: ShopItemId.HealthPotion, name: 'Health Potion', cost: 240, description: 'Restore 45 HP to target hero, or the Frontline hero by default.', requiresTarget: 'hero' },
  { id: ShopItemId.FrontlineShield, name: 'Frontline Shield', cost: 220, description: 'Add 55 shield to the current Frontline hero.' },
  { id: ShopItemId.TeamShield, name: 'Team Shield', cost: 420, description: 'Add 25 shield to every living hero.' },
  { id: ShopItemId.CoreStabilizer, name: 'Core Stabilizer', cost: 520, description: 'Shave one layer from the Static core.' },
  { id: ShopItemId.RerollQueue, name: 'Queue Reroll', cost: 120, description: 'Reroll the visible block queue.' },
  { id: ShopItemId.BombRadius1, name: 'Breach Bomb', cost: 380, description: 'Erase destructible blocks in radius 1 around selected cell.', requiresTarget: 'cell' },
  { id: ShopItemId.CleanseLock, name: 'Lock Cleanser', cost: 180, description: 'Remove Locked status from selected cell.', requiresTarget: 'cell' },
  { id: ShopItemId.ExtraMove, name: 'Borrowed Time', cost: 260, description: '+1 move next player turn.' }
]);

export function getShopItem(id: ShopItemId): ShopItemDefinition | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
