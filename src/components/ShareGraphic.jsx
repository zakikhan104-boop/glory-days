// ShareGraphic — FIFA/EA FC inspired match recap card
// Colors: #1f2a1e (bg), #f8406d (hot pink), #d11d4b (deep red),
//         #443c3a (surface), #8fa5a8 (muted blue-gray)
// Font: Bebas Neue (headings) + Inter (body)
// Captured at 2x scale by html2canvas → crisp on retina

import { statEmoji, statAbbr } from '../lib/voiceParser';

const STATS    = ['goals', 'killerGoals', 'golasos', 'oles', 'megs'];
const C = {
  bg:      '#1f2a1e',
  surface: '#443c3a',
  pink:    '#f8406d',
  red:     '#d11d4b',
  muted:   '#8fa5a8',
  white:   '#ffffff',
  dim:     'rgba(143,165,168,0.18)',
};

// Compute FIFA-style overall rating (60–99)
function computeRating(s) {
  if (!s) return 60;
  const w =
    (s.goals       ?? 0) * 5 +
    (s.killerGoals ?? 0) * 9 +
    (s.golasos     ?? 0) * 7 +
    (s.oles        ?? 0) * 3 +
    (s.megs        ?? 0) * 5;
  return Math.min(99, 60 + w);
}

function totalWeighted(s) { return computeRating(s) - 60; }

// Rating color tier (like FIFA bronze/silver/gold)
function ratingColor(r) {
  if (r >= 87) return { bg: C.pink,  text: '#fff' };
  if (r >= 75) return { bg: C.red,   text: '#fff' };
  if (r >= 65) return { bg: C.muted, text: C.bg   };
  return              { bg: '#555',  text: '#ccc' };
}

// ── Diamond grid SVG pattern (subtle background texture) ──────────────────────
function DiamondPattern() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="diamonds" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
          <polygon
            points="16,2 30,16 16,30 2,16"
            fill="none"
            stroke="#f8406d"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#diamonds)" />
    </svg>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({ entry, rank, isMvp }) {
  const { player, stats: s } = entry;
  const rating = computeRating(s);
  const { bg: rBg, text: rText } = ratingColor(rating);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: isMvp ? '12px 14px' : '9px 14px',
      background: isMvp
        ? `linear-gradient(90deg, rgba(248,64,109,0.18) 0%, rgba(209,29,75,0.08) 100%)`
        : (rank % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'),
      borderRadius: 10,
      borderLeft: isMvp ? `3px solid ${C.pink}` : '3px solid transparent',
    }}>
      {/* Rating bubble */}
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: rBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 17, color: rText, lineHeight: 1 }}>{rating}</span>
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: isMvp ? 18 : 15,
          color: isMvp ? C.white : C.white,
          letterSpacing: 1,
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {isMvp ? '👑 ' : ''}{player.name.toUpperCase()}
        </span>
      </div>

      {/* Stat counts */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {STATS.map(k => {
          const val = s[k] ?? 0;
          return (
            <div key={k} style={{ textAlign: 'center', width: 26 }}>
              <div style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: isMvp ? 18 : 15,
                color: val > 0 ? (k === 'killerGoals' || k === 'golasos' ? C.pink : C.white) : 'rgba(255,255,255,0.15)',
                lineHeight: 1,
              }}>
                {val}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main graphic ──────────────────────────────────────────────────────────────
export default function ShareGraphic({ game, roster, graphicRef }) {
  if (!game) return null;

  const entries = Object.entries(game.stats)
    .map(([id, s]) => ({ player: roster.find(p => p.id === id), stats: s }))
    .filter(e => e.player)
    .sort((a, b) => totalWeighted(b.stats) - totalWeighted(a.stats));

  const date = new Date(game.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();

  return (
    <div
      ref={graphicRef}
      style={{
        width: 390,
        background: C.bg,
        fontFamily: "'Inter', system-ui, sans-serif",
        color: C.white,
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: 32,
      }}
    >
      {/* Background diamond texture */}
      <DiamondPattern />

      {/* Top accent bar */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${C.pink} 0%, ${C.red} 100%)`,
      }} />

      {/* Header */}
      <div style={{ padding: '24px 24px 12px', position: 'relative' }}>
        {/* STREETFC title */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 52,
              lineHeight: 0.9,
              background: `linear-gradient(135deg, ${C.pink} 0%, ${C.red} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: 2,
            }}>
              STREET
            </div>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 52,
              lineHeight: 0.9,
              background: `linear-gradient(135deg, ${C.red} 0%, ${C.pink} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: 2,
            }}>
              FC
            </div>
          </div>

          {/* Date + match info block */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 13,
              color: C.muted,
              letterSpacing: 2,
              marginBottom: 2,
            }}>
              MATCH RECAP
            </div>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 13,
              color: C.pink,
              letterSpacing: 1,
            }}>
              {date}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              {entries.length} PLAYERS
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height: 1,
          background: `linear-gradient(90deg, ${C.pink}44 0%, transparent 100%)`,
          marginTop: 16,
        }} />
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px 6px 24px',
        gap: 10,
      }}>
        <div style={{ width: 38 }} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {STATS.map(k => (
            <div key={k} style={{
              width: 26,
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: C.muted,
              letterSpacing: 1,
            }}>
              {statAbbr(k)}
            </div>
          ))}
        </div>
      </div>

      {/* Player rows */}
      <div style={{ padding: '0 10px' }}>
        {entries.map((entry, i) => (
          <PlayerRow key={entry.player.id} entry={entry} rank={i} isMvp={i === 0} />
        ))}
      </div>

      {/* Stat emoji legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        padding: '18px 24px 0',
        flexWrap: 'wrap',
      }}>
        {STATS.map(k => (
          <span key={k} style={{ fontSize: 10, color: C.muted, letterSpacing: 0.5 }}>
            {statEmoji(k)} {statAbbr(k)}
          </span>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        margin: '20px 24px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ height: 1, flex: 1, background: `rgba(143,165,168,0.15)` }} />
        <span style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 11,
          color: `${C.pink}99`,
          letterSpacing: 3,
          padding: '0 12px',
        }}>
          #STREETFC
        </span>
        <div style={{ height: 1, flex: 1, background: `rgba(143,165,168,0.15)` }} />
      </div>
    </div>
  );
}
