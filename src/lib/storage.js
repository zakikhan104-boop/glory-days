// ─── storage.js ────────────────────────────────────────────────────────────────
// Simple localStorage wrappers. Data shape:
//   roster  → Player[]
//   games   → Game[]
//
// Player  = { id, name, number? }
// Game    = { id, date, stats: { [playerId]: StatRow } }
// StatRow = { goals, killerGoals, golasos, oles, megs }
// ─────────────────────────────────────────────────────────────────────────────

const ROSTER_KEY = 'sfc_roster';
const GAMES_KEY  = 'sfc_games';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function emptyStats() {
  return { goals: 0, killerGoals: 0, golasos: 0, oles: 0, megs: 0 };
}

// ── Roster ────────────────────────────────────────────────────────────────────

export function getRoster() {
  try { return JSON.parse(localStorage.getItem(ROSTER_KEY)) ?? []; }
  catch { return []; }
}

export function saveRoster(roster) {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
}

export function addPlayer(name, number = '') {
  const roster = getRoster();
  const player = { id: uid(), name: name.trim(), number: number.trim() };
  roster.push(player);
  saveRoster(roster);
  return player;
}

export function removePlayer(id) {
  saveRoster(getRoster().filter(p => p.id !== id));
}

// ── Games ─────────────────────────────────────────────────────────────────────

export function getGames() {
  try { return JSON.parse(localStorage.getItem(GAMES_KEY)) ?? []; }
  catch { return []; }
}

export function saveGames(games) {
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

export function createGame(playerIds) {
  const games = getGames();
  const stats = {};
  playerIds.forEach(id => { stats[id] = emptyStats(); });
  const game = { id: uid(), date: new Date().toISOString(), stats };
  games.push(game);
  saveGames(games);
  return game;
}

export function getGame(id) {
  return getGames().find(g => g.id === id) ?? null;
}

export function incrementStat(gameId, playerId, stat) {
  const games = getGames();
  const game  = games.find(g => g.id === gameId);
  if (!game) return;
  if (!game.stats[playerId]) game.stats[playerId] = emptyStats();
  game.stats[playerId][stat] = (game.stats[playerId][stat] ?? 0) + 1;
  saveGames(games);
  return game;
}

export function decrementStat(gameId, playerId, stat) {
  const games = getGames();
  const game  = games.find(g => g.id === gameId);
  if (!game) return;
  if (!game.stats[playerId]) game.stats[playerId] = emptyStats();
  game.stats[playerId][stat] = Math.max(0, (game.stats[playerId][stat] ?? 0) - 1);
  saveGames(games);
  return game;
}

export function endGame(gameId) {
  const games = getGames();
  const game  = games.find(g => g.id === gameId);
  if (game) { game.ended = true; saveGames(games); }
  return game;
}
