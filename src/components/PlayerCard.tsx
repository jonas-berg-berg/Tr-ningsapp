import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/900.css';
import { HALF, TIERS, tierLabel, type CardStats } from '@/lib/card';
import './player-card.css';

/** Namnet ska få plats på en rad även när det är långt. */
function nameSize(name: string): number {
  if (name.length <= 7) return 52;
  if (name.length <= 10) return 42;
  if (name.length <= 14) return 32;
  return 26;
}

function Flame() {
  return (
    <svg className="pc-flame" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#ff7a1a" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" />
      <path fill="#ffd23f" d="M12 12c.6 1.6 2 2.4 2 4a2 2 0 0 1-4 0c0-1 .6-1.8 1-2.2.2.8.6 1.2 1 1.2 0-1.2-.4-2 0-3z" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </svg>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="pc-stat">
      <b className="pc-stat-value">{value}</b>
      <span className="pc-stat-label">{label}</span>
    </div>
  );
}

function Part({ label, value, unit, score }: { label: string; value: number; unit?: string; score: number }) {
  return (
    <div className="pc-part">
      <span className="pc-part-label">
        {label}: <b>{value}</b>
        {unit ? ` ${unit}` : ''}
      </span>
      <span className="pc-part-value">{score}</span>
      <span className="pc-bar" aria-hidden>
        <i style={{ width: `${score}%` }} />
      </span>
    </div>
  );
}

export function PlayerCard({
  name,
  jerseyNumber,
  stats,
  passesLeft = null,
}: {
  name: string;
  jerseyNumber: number | null;
  stats: CardStats;
  /** Pass kvar till nästa nivå (från triggers), annars visas betyg kvar. */
  passesLeft?: number | null;
}) {
  const tierIndex = TIERS.findIndex((t) => t.tier === stats.tier);
  const label = tierLabel(stats.tier);

  return (
    <section className="pc-wrap" aria-label="Ditt spelarkort">
      <div className="pc-stage">
        <div
          className="pc-card"
          data-tier={stats.tier}
          role="img"
          aria-label={`${name}${jerseyNumber !== null ? `, nummer ${jerseyNumber}` : ''}. Betyg ${stats.rating}, nivå ${label}. Streak ${stats.currentStreak} dagar, rekord ${stats.longestStreak}. ${stats.total} pass totalt, ${stats.last28} senaste 4 veckorna.`}
        >
          {jerseyNumber !== null && (
            <div className="pc-jersey" aria-hidden>
              <span className="pc-jersey-fill">{jerseyNumber}</span>
              <span className="pc-jersey-line">{jerseyNumber}</span>
            </div>
          )}

          <div className={`pc-layer pc-head`}>
            <div>
              <div className="pc-rating">{stats.rating}</div>
              <div className="pc-rating-label">BETYG</div>
            </div>
            <span className="pc-tier">{label}</span>
          </div>

          <div className={`pc-layer pc-name-block`}>
            {jerseyNumber !== null && <span className="pc-number">#{jerseyNumber}</span>}
            <div className="pc-name" style={{ fontSize: nameSize(name) }}>
              {name}
            </div>
          </div>

          <div className={`pc-layer pc-stats`}>
            <div className={`pc-group ${stats.activeToday ? 'pc-hot' : ''}`}>
              <div className="pc-group-head">
                <Flame />
                Streak
              </div>
              <Stat value={stats.currentStreak} label="Pågående" />
              <Stat value={stats.longestStreak} label="Rekord" />
            </div>
            <div className="pc-group">
              <div className="pc-group-head">
                <Check />
                Pass
              </div>
              <Stat value={stats.total} label="Totalt" />
              <Stat value={stats.last28} label="4 veckor" />
            </div>
          </div>
        </div>
      </div>

      <div className="pc-panel">
        <div className="pc-panel-row">
          {stats.next ? (
            <>
              <span>
                Nästa nivå: <strong>{tierLabel(stats.next.tier)}</strong>
              </span>
              <span>{passesLeft !== null ? `${passesLeft} pass kvar` : `${stats.next.pointsLeft} betyg kvar`}</span>
            </>
          ) : (
            <span>
              Du har <strong>högsta nivån</strong>
            </span>
          )}
        </div>
        <div className="pc-ladder" aria-hidden>
          {TIERS.map((t, i) => (
            <i key={t.tier} data-done={i <= tierIndex} />
          ))}
        </div>
        <div className="pc-tiers">
          {TIERS.map((t) => (
            <span key={t.tier} aria-current={t.tier === stats.tier ? 'step' : undefined}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <details className={`pc-panel pc-breakdown`}>
        <summary className="pc-panel-row">
          <span>
            Så räknas <strong>betyget</strong>
          </span>
          <span className="pc-chevron" aria-hidden>
            ›
          </span>
        </summary>
        <Part label="Pass senaste 4 veckorna" value={stats.last28} score={stats.parts.last28} />
        <Part label="Pass senaste 7 dagarna" value={stats.last7} score={stats.parts.last7} />
        <Part label="Rekordstreak" value={stats.longestStreak} unit="dagar" score={stats.parts.longest} />
        <p className="pc-note">
          Betyget är snittet av de tre delarna, från 40 till 99. Varje pass ger alltid mer, men lite mindre för
          varje gång. Halva vägen till 99 når du vid {HALF.last28} pass på 4 veckor, {HALF.last7} pass på 7 dagar
          och {HALF.longest} dagars rekordstreak.
        </p>
      </details>
    </section>
  );
}
