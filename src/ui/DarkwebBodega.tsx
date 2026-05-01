import { SHOP_ITEMS } from '../data/shopItems';
import { ShopItemId } from '../sim/ShopSystem';

type DarkwebBodegaProps = {
  open: boolean;
  credits: number;
  selectedCellIndex: number;
  rerollsUsedThisShop: number;
  onBuy: (itemId: ShopItemId) => void;
  onContinue: () => void;
};

export function DarkwebBodega({ open, credits, selectedCellIndex, rerollsUsedThisShop, onBuy, onContinue }: DarkwebBodegaProps) {
  if (!open) return null;
  return (
    <div className="shop-overlay">
      <div className="panel shop-window corrupted-phone">
        <div className="shop-title">Darkweb Bodega</div>
        <div className="shop-subtitle">Cleaner App // contraband cards // no refunds after manifestation</div>
        <div className="shop-status">Credits: <strong>{credits}</strong> / selected cell: <strong>{selectedCellIndex >= 0 ? selectedCellIndex : 'none'}</strong></div>
        <div className="shop-grid">
          {SHOP_ITEMS.map((item) => {
            const needsCell = item.requiresTarget === 'cell';
            const rerollSpent = item.id === ShopItemId.RerollQueue && rerollsUsedThisShop >= 1;
            const disabled = credits < item.cost || (needsCell && selectedCellIndex < 0) || rerollSpent;
            return (
              <div className={`shop-item ${rerollSpent ? 'no-signal' : ''}`} key={item.id}>
                <div className="shop-item-name">{item.name}</div>
                <div className="shop-item-desc">{rerollSpent ? 'NO SIGNAL. Refresh already burned this shop phase.' : item.description}</div>
                <button disabled={disabled} onClick={() => onBuy(item.id)}>{rerollSpent ? 'NO SIGNAL' : `Buy / ${item.cost}`}</button>
              </div>
            );
          })}
        </div>
        <div className="shop-footer"><button onClick={onContinue}>Next monster</button></div>
      </div>
    </div>
  );
}
