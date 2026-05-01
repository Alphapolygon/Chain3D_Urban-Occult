import { SHOP_ITEMS } from '../data/shopItems';
import type { ShopItemId } from '../sim/ShopSystem';

type DarkwebBodegaProps = { open: boolean; credits: number; selectedCellIndex: number; onBuy: (itemId: ShopItemId) => void; onContinue: () => void; };

export function DarkwebBodega({ open, credits, selectedCellIndex, onBuy, onContinue }: DarkwebBodegaProps) {
  if (!open) return null;
  return (
    <div className="shop-overlay">
      <div className="panel shop-window">
        <div className="shop-title">Darkweb Bodega</div>
        <div style={{ color: 'rgba(255,255,255,0.76)', marginTop: 6 }}>Spend run points before the next nightmare arrives. Cell-target items use the last selected Breach block.</div>
        <div style={{ marginTop: 8 }}>Credits: <strong>{credits}</strong> / selected cell: <strong>{selectedCellIndex >= 0 ? selectedCellIndex : 'none'}</strong></div>
        <div className="shop-grid">
          {SHOP_ITEMS.map((item) => {
            const needsCell = item.requiresTarget === 'cell';
            const disabled = credits < item.cost || (needsCell && selectedCellIndex < 0);
            return (
              <div className="shop-item" key={item.id}>
                <div className="shop-item-name">{item.name}</div>
                <div className="shop-item-desc">{item.description}</div>
                <button disabled={disabled} onClick={() => onBuy(item.id)}>Buy / {item.cost}</button>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}><button onClick={onContinue}>Next monster</button></div>
      </div>
    </div>
  );
}
