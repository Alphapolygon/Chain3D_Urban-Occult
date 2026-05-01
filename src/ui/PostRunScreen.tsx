import { colorToCss } from '../sim/CellBits';
import type { HeroState } from '../sim/CombatSystem';
import type { MetaProgressReport } from '../data/metaProgress';
import { getXpRequiredForNextLevel } from '../data/metaProgress';

type PostRunScreenProps = {
  lossReason: string;
  score: number;
  enemiesDefeated: number;
  xpAwarded: number;
  heroes: HeroState[];
  report: MetaProgressReport;
  onRestart: () => void;
  onDraft?: () => void;
};

export function PostRunScreen({ lossReason, score, enemiesDefeated, xpAwarded, heroes, report, onRestart, onDraft }: PostRunScreenProps) {
  const awards = report.heroAwards.length > 0
    ? report.heroAwards
    : heroes.map((hero) => ({
        heroId: hero.id,
        heroName: hero.name,
        color: hero.color,
        xpAwarded,
        levelBefore: hero.metaLevel ?? 1,
        levelAfter: hero.metaLevel ?? 1,
        xpBefore: 0,
        xpAfter: 0,
        xpRequiredForNext: getXpRequiredForNextLevel(hero.metaLevel ?? 1),
        leveledUp: false,
        unlockedCards: [],
        messages: []
      }));

  return (
    <div className="game-over post-run-screen">
      <div className="panel post-run-panel">
        <div className="post-run-kicker">DEEP WEB HANDSHAKE LOST</div>
        <div className="shop-title post-run-title">CONNECTION SEVERED</div>
        <p className="post-run-reason">{lossReason}</p>

        <div className="post-run-stats">
          <div><span>Final Score</span><strong>{score}</strong></div>
          <div><span>Nightmares Banished</span><strong>{enemiesDefeated}</strong></div>
          <div><span>Meta-XP Earned</span><strong className="xp-glow">+{xpAwarded} XP</strong></div>
        </div>

        <div className="post-run-subtitle">Cleaner Progression</div>
        <div className="progress-stack">
          {awards.map((award) => {
            const xpPct = Math.min(100, award.xpRequiredForNext > 0 ? (award.xpAfter / award.xpRequiredForNext) * 100 : 100);
            const color = colorToCss(award.color);
            return (
              <div className={`progress-card ${award.leveledUp ? 'level-up' : ''}`} key={award.heroId}>
                <div className="progress-card-head">
                  <strong style={{ color }}>{award.heroName}</strong>
                  <span>
                    Lv {award.levelAfter}
                    {award.leveledUp ? <b> LEVEL UP</b> : null}
                  </span>
                </div>
                <div className="bar meta-xp-bar"><div style={{ width: `${xpPct}%`, background: color }} /></div>
                <div className="progress-card-foot">
                  <span>+{award.xpAwarded} XP this run</span>
                  <span>{award.xpAfter} / {award.xpRequiredForNext} XP</span>
                </div>
                {award.messages.length > 0 ? (
                  <div className="decrypt-messages">
                    {award.messages.map((message) => <div key={message}>{message}</div>)}
                  </div>
                ) : null}
                {award.unlockedCards.length > 0 ? (
                  <div className="unlocked-cards">
                    {award.unlockedCards.map((card) => <span key={card}>{card}</span>)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="post-run-actions">
          <button className="post-run-restart" onClick={onRestart}>Start Next Run</button>
          {onDraft ? <button className="post-run-draft" onClick={onDraft}>Change Team</button> : null}
        </div>
      </div>
    </div>
  );
}
