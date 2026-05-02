import { useState } from 'react';
import { HEROES } from '../data/heroes';
import type { HeroDefinition } from '../sim/CombatSystem';
import type { RunConfig, RunSnapshot } from '../sim/RunState';
import type { ShopItemId } from '../sim/ShopSystem';
import { CharacterInfoPopup, type CharacterInfoSelection } from './CharacterInfoPopup';
import { DarkwebBodega } from './DarkwebBodega';
import { DebugMenu } from './DebugMenu';
import { DraftScreen } from './DraftScreen';
import { PostRunScreen } from './PostRunScreen';
import { QueuePreview } from './QueuePreview';
import { RunMiniPanel } from './RunMiniPanel';
import { SpecialControls } from './SpecialControls';

type GameAppProps = {
  snapshot: RunSnapshot;
  gameStarted: boolean;
  draftedHeroIds: readonly string[];
  runConfig: RunConfig;
  speedMode: boolean;
  selectedCharacter: CharacterInfoSelection | null;
  onStartDraft: (draft: HeroDefinition[]) => void;
  onApplyDebugConfig: (config: RunConfig) => void;
  onToggleSpeedMode: () => void;
  onSwapCache: () => void;
  onActivateHero: (heroIndex: number) => void;
  onBuy: (itemId: ShopItemId) => void;
  onContinueAfterShop: () => void;
  onForceAttack: () => void;
  onGrowCore: (amount: number) => void;
  onRestart: () => void;
  onReturnToDraft: () => void;
  onCloseCharacterInfo: () => void;
};

export function GameApp(props: GameAppProps) {
  const [debugOpen, setDebugOpen] = useState(true);

  if (!props.gameStarted) {
    return <DraftScreen heroes={HEROES} initialSelectedIds={props.draftedHeroIds} onStart={props.onStartDraft} />;
  }

  return (
    <>
      {debugOpen
        ? <DebugMenu config={props.runConfig} onApply={props.onApplyDebugConfig} speed={props.speedMode} onToggleSpeed={props.onToggleSpeedMode} onClose={() => setDebugOpen(false)} />
        : <button className="debug-toggle" onClick={() => setDebugOpen(true)} title="Open debug menu">Debug</button>}

      <div className="hud world-fighter-overlay">
        <div className="side-column left-side">
          <QueuePreview queue={props.snapshot.queue} cacheColor={props.snapshot.cacheColor} cacheUsedThisTurn={props.snapshot.cacheUsedThisTurn} onSwapCache={props.onSwapCache} />
          <SpecialControls snapshot={props.snapshot} onActivateHero={props.onActivateHero} />
        </div>
        <div className="center-help">{helpTextFor(props.snapshot)}</div>
        <div className="side-column right-side">
          <RunMiniPanel snapshot={props.snapshot} onForceAttack={props.onForceAttack} onGrowCore={props.onGrowCore} onRestart={props.onRestart} />
        </div>
      </div>

      <CharacterInfoPopup selection={props.selectedCharacter} heroes={props.snapshot.heroes} enemy={props.snapshot.enemy} frontlineIndex={props.snapshot.frontlineIndex} onClose={props.onCloseCharacterInfo} />
      <DarkwebBodega open={props.snapshot.shopOpen} credits={props.snapshot.credits} selectedCellIndex={props.snapshot.selectedCellIndex} rerollsUsedThisShop={props.snapshot.rerollsUsedThisShop} onBuy={props.onBuy} onContinue={props.onContinueAfterShop} />
      {props.snapshot.phase === 'enemy-turn' ? <div className="enemy-turn-banner">ENEMY TURN</div> : null}
      {props.snapshot.phase === 'ko' ? <div className="ko-banner">NIGHTMARE BANISHED</div> : null}
      {props.snapshot.runOver
        ? <PostRunScreen
            lossReason={props.snapshot.lossReason}
            score={props.snapshot.score}
            enemiesDefeated={props.snapshot.enemiesDefeated}
            xpAwarded={props.snapshot.metaXpAwarded}
            heroes={props.snapshot.heroes}
            report={props.snapshot.metaProgressReport}
            onRestart={props.onRestart}
            onDraft={props.onReturnToDraft}
          />
        : null}
    </>
  );
}

function helpTextFor(snapshot: RunSnapshot): string {
  if (snapshot.phase === 'ko') return 'K.O. Nightmare banished. Darkweb Bodega is connecting...';
  if (snapshot.phase === 'enemy-turn') return 'ENEMY TURN. Brace for impact.';
  if (snapshot.shopOpen) return 'Shop is open. Breach input is locked until you continue to the next monster.';
  return 'Click an exposed cube face to place the next block. Drag the Breach itself to rotate it freely.';
}
