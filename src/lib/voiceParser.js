// ─── voiceParser.js ───────────────────────────────────────────────────────────
// Two-tier parsing:
//   1. PRIMARY — Claude API (claude-haiku) for natural language understanding.
//      Handles mishearings, slang, context. Requires VITE_ANTHROPIC_API_KEY.
//   2. FALLBACK — Local regex with expanded keywords + mishearing corrections.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stat metadata ─────────────────────────────────────────────────────────────

export function statLabel(stat) {
  return { goals: 'Goal', killerGoals: 'Killer Goal', golasos: 'Golazo', oles: 'Ole', megs: 'Meg' }[stat] ?? stat;
}

export function statEmoji(stat) {
  return { goals: '⚽', killerGoals: '💀', golasos: '🌟', oles: '🔄', megs: '🦵' }[stat] ?? '?';
}

export function statAbbr(stat) {
  return { goals: 'GOL', killerGoals: 'KLR', golasos: 'GLZ', oles: 'OLE', megs: 'MEG' }[stat] ?? stat;
}

const VALID_STATS = ['goals', 'killerGoals', 'golasos', 'oles', 'megs'];

// ── Claude API parser (primary) ───────────────────────────────────────────────

async function parseWithClaude(transcript, players) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const playerList = players.map(p => p.name).join(', ');

  const prompt = `You are a streetfc scorekeeping assistant. The game captain is commentating live.

Players in this game: ${playerList}

Stats to track:
- goals: player scores a goal (scored, put it in, finished, slotted, tapped in)
- killerGoals: a killer/decisive/dominant goal
- golasos: a spectacular goal (golazo, golaso, screamer, worldie, banger — NOTE: speech recognition often mishears "golazo" as "colossal", "collar", "colossus", "gallows")
- oles: a great skill/vision play — great ball, great move, great pass, great play, nice ball, nice move, nice pass, good ball, brilliant touch, avoids pressure, dribbles past, creates space, vision play, game-winning play, assists, through ball
- megs: nutmeg — ball through opponent's legs (meg, mega, nutmeg, tunnel, through the legs, through his legs — NOTE: speech recognition may mishear "meg" as "mega" or "nega")

The captain said: "${transcript}"

Return ONLY valid JSON, no explanation: {"player": "exact player name from the list or null", "stat": "goals|killerGoals|golasos|oles|megs or null"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const player = players.find(p => p.name === parsed.player) ?? null;
    const stat   = VALID_STATS.includes(parsed.stat) ? parsed.stat : null;

    return { player, stat, raw: transcript, confidence: (player && stat) ? 'high' : 'low', source: 'claude' };
  } catch {
    return null;
  }
}

// ── Local fallback parser ─────────────────────────────────────────────────────

// Common speech-recognition mishearings → corrected word
const MISHEARING_MAP = {
  // Golazo mishearings
  colossal: 'golazo', colossus: 'golazo', collar: 'golazo',
  gallows: 'golazo',  harlow: 'golazo',   glasgow: 'golazo',
  palazzo: 'golazo',  piazza: 'golazo',
  // Meg mishearings
  mega: 'meg', nega: 'meg', neck: 'meg',
  // Ole mishearings
  hole: 'ole', old: 'ole', all: 'ole',
};

const STAT_PATTERNS = [
  {
    stat: 'killerGoals',
    patterns: [/killer\s*goal/i, /\bkiller\b/i],
  },
  {
    stat: 'golasos',
    patterns: [
      /golaz[ao]/i, /golaso/i, /screamer/i, /worldie/i, /\bbanger\b/i,
      /colossal/i, /colossus/i, /palazzo/i,
    ],
  },
  {
    stat: 'oles',
    patterns: [
      /\boles?\b/i, /olés?/i, /\b[ao]l[eé]\b/i,
      /great\s+(ball|move|pass|play|touch|run)/i,
      /nice\s+(ball|move|pass|play|touch|run)/i,
      /good\s+(ball|move|pass|play|touch)/i,
      /brilliant\s+(touch|pass|move|play|ball)/i,
      /\bvision\b/i, /\bassist\b/i,
      /avoids?\s+pressure/i, /dribbles?\s+past/i,
      /creates?\s+(space|chance)/i,
      /through\s+ball/i, /game.win/i,
    ],
  },
  {
    stat: 'megs',
    patterns: [
      /\bmegs?\b/i, /\bmega\b/i, /nutmeg/i, /megged/i, /nutmegged/i,
      /through\s+(the\s+)?legs/i, /\btunnel\b/i, /\bnega\b/i,
    ],
  },
  {
    stat: 'goals',
    patterns: [
      /\bgoal\b/i, /\bscored?\b/i, /\bscores?\b/i,
      /\bfinish/i, /\bslot/i, /\btap.in\b/i, /put it in/i,
    ],
  },
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameScore(word, namePart) {
  if (!namePart || namePart.length < 2) return 0;
  const w = word.toLowerCase(), n = namePart.toLowerCase();
  if (w === n) return 100;
  if (n.startsWith(w) && w.length >= 3) return 70;
  if (w.includes(n) || n.includes(w)) return 50;
  const dist = levenshtein(w, n);
  if (dist <= Math.max(1, Math.floor(n.length / 4))) return 40 - dist * 10;
  return 0;
}

function parseLocal(transcript, players) {
  // Apply mishearing corrections to a copy
  let corrected = transcript;
  for (const [bad, good] of Object.entries(MISHEARING_MAP)) {
    corrected = corrected.replace(new RegExp(`\\b${bad}\\b`, 'gi'), good);
  }

  const words = corrected.toLowerCase().split(/\s+/);

  // Detect stat
  let detectedStat = null;
  for (const { stat, patterns } of STAT_PATTERNS) {
    if (patterns.some(p => p.test(corrected))) { detectedStat = stat; break; }
  }

  // Detect player
  let bestPlayer = null, bestScore = 0;
  for (const player of players) {
    let score = 0;
    for (const part of player.name.split(/\s+/)) {
      for (const word of words) score = Math.max(score, nameScore(word, part));
    }
    if (score > bestScore) { bestScore = score; bestPlayer = player; }
  }

  const player     = bestScore >= 40 ? bestPlayer : null;
  const confidence = (player && detectedStat && bestScore >= 70) ? 'high' : 'low';
  return { player, stat: detectedStat, raw: transcript, confidence, source: 'local' };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a voice transcript into { player, stat, confidence, source }.
 * Tries Claude API first (if key is set), falls back to local regex.
 */
export async function parseTranscript(transcript, players) {
  if (!transcript?.trim() || players.length === 0) {
    return { player: null, stat: null, raw: transcript, confidence: 'low', source: 'none' };
  }

  const claudeResult = await parseWithClaude(transcript, players);
  if (claudeResult) return claudeResult;

  return parseLocal(transcript, players);
}
