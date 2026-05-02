import React from 'react';
import { colorToCss } from '../sim/CellBits';
import type { EnemyState, FighterSpriteSet, HeroState } from '../sim/CombatSystem';

type CharacterInfoSelection =
  | { kind: 'hero'; index: number }
  | { kind: 'enemy' };

type CharacterInfoPopupProps = {
  selection: CharacterInfoSelection | null;
  heroes: readonly HeroState[];
  enemy: EnemyState;
  frontlineIndex: number;
  onClose: () => void;
};

function spriteStateList(sprites?: FighterSpriteSet): string {
  if (!sprites) return 'idle fallback';
  const states = ['idle', 'attack', 'hit', 'special', 'die'].filter((state) => !!sprites[state as keyof FighterSpriteSet]);
  return states.length > 0 ? states.join(', ') : 'idle fallback';
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="character-info-row"><span>{label}</span><strong>{value}</strong></div>;
}

export function CharacterInfoPopup({ selection, heroes, enemy, frontlineIndex, onClose }: CharacterInfoPopupProps) {
  if (!selection) return null;

  if (selection.kind === 'hero') {
    const hero = heroes[selection.index];
    if (!hero) return null;
    const ready = hero.hp > 0 && hero.ap >= hero.maxAp;
    const color = colorToCss(hero.color);
    const spriteUrl = hero.sprites?.idle ?? hero.spriteUrl;

    return (
      <div className="character-info-backdrop" onMouseDown={onClose}>
        <div className="character-info-panel hero-info" onMouseDown={(event) => event.stopPropagation()}>
          <button className="character-info-close" onClick={onClose}>x</button>
          <div className="character-info-header">
            {spriteUrl ? <img src={spriteUrl} alt={hero.name} /> : null}
            <div>
              <div className="character-info-title" style={{ color }}>{hero.name}</div>
              <div className="character-info-subtitle">{hero.role.toUpperCase()} // Cleaner #{selection.index + 1}</div>
            </div>
          </div>

          <div className="character-info-grid">
            <StatRow label="Status" value={hero.hp <= 0 ? 'DOWN' : ready ? 'SPECIAL READY' : selection.index === frontlineIndex ? 'FRONTLINE' : 'BACKLINE'} />
            <StatRow label="HP" value={`${hero.hp}/${hero.maxHp}`} />
            <StatRow label="Shield" value={hero.shield} />
            <StatRow label="AP" value={`${hero.ap}/${hero.maxAp}`} />
            <StatRow label="Base Damage" value={hero.baseDamage} />
            <StatRow label="Color" value={<span style={{ color }}>{color}</span>} />
            <StatRow label="Active Power" value={hero.activePower} />
            <StatRow label="Meta Level" value={hero.metaLevel ?? 1} />
            <StatRow label="Sprite States" value={spriteStateList(hero.sprites)} />
          </div>

          <div className="character-info-note">
            Matching this Cleaner&apos;s color fills AP. When AP reaches max, press CAST from the Specials strip.
          </div>
        </div>
      </div>
    );
  }

  const spriteUrl = enemy.sprites?.idle ?? enemy.spriteUrl;
  return (
    <div className="character-info-backdrop" onMouseDown={onClose}>
      <div className="character-info-panel enemy-info" onMouseDown={(event) => event.stopPropagation()}>
        <button className="character-info-close" onClick={onClose}>x</button>
        <div className="character-info-header enemy">
          {spriteUrl ? <img src={spriteUrl} alt={enemy.name} /> : null}
          <div>
            <div className="character-info-title enemy">{enemy.name}</div>
            <div className="character-info-subtitle">Nightmare // Wave {enemy.wave}</div>
          </div>
        </div>

        <div className="character-info-grid">
          <StatRow label="HP" value={`${enemy.hp}/${enemy.maxHp}`} />
          <StatRow label="Damage" value={enemy.damage} />
          <StatRow label="Attack Timer" value={`${enemy.attackTimer} moves`} />
          <StatRow label="Base Cadence" value={`${enemy.attackEveryTurns} moves`} />
          <StatRow label="Core Growth" value={`+${enemy.growthAmount}`} />
          <StatRow label="Poise" value={enemy.poiseTurns > 0 ? `${enemy.poiseTurns} turn` : 'none'} />
          <StatRow label="Sprite States" value={spriteStateList(enemy.sprites)} />
        </div>

        <div className="character-info-note">
          Heavy Island Snaps can knock the Nightmare down, but Poise prevents repeated stun-locking.
        </div>
      </div>
    </div>
  );
}

export type { CharacterInfoSelection };
