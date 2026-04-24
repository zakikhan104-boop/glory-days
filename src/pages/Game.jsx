import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGame, getRoster, incrementStat, decrementStat, endGame } from '../lib/storage';
import { parseTranscript, statLabel, statEmoji } from '../lib/voiceParser';

const STATS = [
  { key: 'goals',       emoji: '⚽', label: 'Goal' },
  { key: 'killerGoals', emoji: '💀', label: 'Killer' },
  { key: 'golasos',     emoji: '🌟', label: 'Golazo' },
  { key: 'oles',        emoji: '🔄', label: 'Ole' },
  { key: 'megs',        emoji: '🦵', label: 'Meg' },
];

// ─── Voice hook ───────────────────────────────────────────────────────────────

function useVoice({ onFinalResult }) {
  const recognitionRef = useRef(null);
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported,  setSupported]  = useState(true);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }

    const rec = new SpeechRecognition();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) onFinalResult(final.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    recognitionRef.current = rec;
  }, [onFinalResult]);

  const start = useCallback(() => {
    setTranscript('');
    try { recognitionRef.current?.start(); } catch {}
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, transcript, supported, start, stop };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Game() {
  const { gameId } = useParams();
  const navigate   = useNavigate();

  const [game,      setGame]       = useState(null);
  const [roster,    setRoster]     = useState([]);
  const [players,   setPlayers]    = useState([]);
  const [selected,  setSelected]   = useState(null);
  const [voiceMode, setVoiceMode]  = useState(false);
  const [parsed,    setParsed]     = useState(null);
  const [parsing,   setParsing]    = useState(false);  // Claude API in-flight
  const [feed,      setFeed]       = useState([]);
  const [showEnd,   setShowEnd]    = useState(false);

  function reload() {
    const g = getGame(gameId);
    if (!g) { navigate('/'); return; }
    setGame(g);
    const r = getRoster();
    setRoster(r);
    const ps = Object.keys(g.stats).map(id => r.find(p => p.id === id)).filter(Boolean);
    setPlayers(ps);
    if (!selected && ps.length > 0) setSelected(ps[0].id);
  }

  useEffect(() => { reload(); }, [gameId]);

  // ── Stat action ──────────────────────────────────────────────────────────────
  function doStat(playerId, statKey, direction = 1) {
    const fn = direction > 0 ? incrementStat : decrementStat;
    const updated = fn(gameId, playerId, statKey);
    setGame({ ...updated });
    if (direction > 0) {
      const player = roster.find(p => p.id === playerId);
      setFeed(f => [{ id: Date.now(), player: player?.name, stat: statKey }, ...f.slice(0, 9)]);
    }
  }

  // ── Voice — async with Claude API ────────────────────────────────────────────
  const handleFinalResult = useCallback(async (text) => {
    setParsed(null);
    setParsing(true);
    try {
      const result = await parseTranscript(text, players);
      setParsed(result);
    } finally {
      setParsing(false);
    }
  }, [players]);

  const { listening, transcript, supported, start, stop } = useVoice({ onFinalResult: handleFinalResult });

  function confirmVoiceStat() {
    if (!parsed?.player || !parsed?.stat) return;
    doStat(parsed.player.id, parsed.stat);
    setParsed(null);
  }

  function handleEndGame() {
    endGame(gameId);
    navigate(`/summary/${gameId}`);
  }

  if (!game) return null;
  const stats = game.stats;

  function totalFor(id) {
    const s = stats[id];
    if (!s) return 0;
    return (s.goals ?? 0) + (s.killerGoals ?? 0) + (s.golasos ?? 0) + (s.oles ?? 0) + (s.megs ?? 0);
  }

  return (
    <div className="min-h-screen text-white flex flex-col select-none" style={{ background: '#1f2a1e' }}>

      {/* Header */}
      <header className="px-4 pt-12 pb-3 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-gray-400 text-xl p-1">←</button>
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#8fa5a8' }}>Live</p>
          <p className="text-sm font-bold">{new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
        <button
          onClick={() => setShowEnd(true)}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg"
          style={{ color: '#f8406d', background: 'rgba(248,64,109,0.12)' }}
        >
          End
        </button>
      </header>

      {/* Activity feed */}
      {feed.length > 0 && (
        <div className="px-4 mb-2">
          <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: '#443c3a' }}>
            <span className="text-base">{statEmoji(feed[0].stat)}</span>
            <span className="text-sm flex-1" style={{ color: '#8fa5a8' }}>
              <span className="font-semibold text-white">{feed[0].player}</span> — {statLabel(feed[0].stat)}
            </span>
          </div>
        </div>
      )}

      {/* Player chips */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {players.map(p => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
                style={{
                  background: active
                    ? 'linear-gradient(135deg, #f8406d, #d11d4b)'
                    : '#443c3a',
                }}
              >
                <span className="text-xs font-bold">{p.name.split(' ')[0]}</span>
                <span className="text-lg font-black text-white">{totalFor(p.id)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stat grid */}
      {selected && (
        <div className="px-4 flex-1">
          <div className="rounded-3xl p-4 space-y-2" style={{ background: '#443c3a' }}>
            <p className="text-xs font-semibold tracking-widest uppercase px-1 pb-1" style={{ color: '#8fa5a8' }}>
              {roster.find(p => p.id === selected)?.name}
            </p>
            {STATS.map(({ key, emoji, label }) => {
              const count = stats[selected]?.[key] ?? 0;
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-2xl px-4"
                  style={{ background: '#1f2a1e' }}
                >
                  <span className="text-2xl py-4 w-8">{emoji}</span>
                  <span className="font-semibold flex-1 text-sm">{label}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => doStat(selected, key, -1)}
                      disabled={count === 0}
                      className="w-9 h-9 rounded-xl font-bold text-lg flex items-center justify-center active:scale-90 transition-all disabled:opacity-25"
                      style={{ background: '#443c3a' }}
                    >
                      −
                    </button>
                    <span className="text-2xl font-black w-8 text-center">{count}</span>
                    <button
                      onClick={() => doStat(selected, key)}
                      className="w-9 h-9 rounded-xl font-bold text-lg flex items-center justify-center active:scale-90 transition-all"
                      style={{ background: 'linear-gradient(135deg, #f8406d, #d11d4b)' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Voice button */}
      {supported && (
        <div className="px-4 py-5">
          <button
            onPointerDown={() => { setVoiceMode(true); start(); }}
            onPointerUp={stop}
            onPointerLeave={stop}
            className="w-full py-5 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-95"
            style={{
              background: listening
                ? 'linear-gradient(135deg, #f8406d, #d11d4b)'
                : '#443c3a',
              animation: listening ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            <span className="text-2xl">{listening ? '🎙️' : '🎤'}</span>
            {listening ? 'Listening…' : 'Hold to commentate'}
          </button>
        </div>
      )}

      {/* Voice overlay */}
      {voiceMode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 gap-6" style={{ background: 'rgba(31,42,30,0.97)' }}>
          <div className="w-full max-w-sm space-y-4">

            {/* Transcript */}
            <div className="rounded-2xl p-5 min-h-24 flex items-start" style={{ background: '#443c3a' }}>
              <p className={`text-lg leading-relaxed ${transcript ? 'text-white' : ''}`} style={{ color: transcript ? '#fff' : '#8fa5a8' }}>
                {transcript || 'Say something like "Richard with a golazo"…'}
              </p>
            </div>

            {/* Parsing spinner */}
            {parsing && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#443c3a' }}>
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#f8406d', borderTopColor: 'transparent' }} />
                <span className="text-sm" style={{ color: '#8fa5a8' }}>Parsing with AI…</span>
              </div>
            )}

            {/* Parsed result */}
            {!parsing && parsed && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: '#443c3a',
                  border: `2px solid ${parsed.confidence === 'high' ? '#f8406d' : '#8fa5a8'}`,
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8fa5a8' }}>
                  {parsed.confidence === 'high' ? '✓ Detected' : 'Best guess'}
                  {parsed.source === 'claude' && <span className="ml-2 text-xs" style={{ color: '#f8406d' }}>· AI</span>}
                </p>
                {parsed.player && parsed.stat ? (
                  <p className="text-lg font-bold">
                    {statEmoji(parsed.stat)} {parsed.player.name} — {statLabel(parsed.stat)}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: '#f8406d' }}>
                    {!parsed.player && !parsed.stat ? "Couldn't detect player or stat" :
                     !parsed.player ? `${statLabel(parsed.stat)} — who scored?` :
                     `${parsed.player.name} — which stat?`}
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              {!parsing && parsed?.player && parsed?.stat && (
                <button
                  onClick={() => { confirmVoiceStat(); setVoiceMode(false); }}
                  className="w-full text-white font-bold py-4 rounded-2xl active:scale-95 transition-all text-lg"
                  style={{ background: 'linear-gradient(135deg, #f8406d, #d11d4b)' }}
                >
                  ✓ Confirm
                </button>
              )}
              <button
                onPointerDown={start}
                onPointerUp={stop}
                onPointerLeave={stop}
                className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all"
                style={{ background: listening ? 'linear-gradient(135deg, #f8406d, #d11d4b)' : '#443c3a' }}
              >
                {listening ? '🔴 Listening…' : '🎤 Hold to speak again'}
              </button>
              <button
                onClick={() => { stop(); setVoiceMode(false); setParsed(null); }}
                className="w-full text-sm py-2"
                style={{ color: '#8fa5a8' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End game confirm */}
      {showEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="rounded-3xl p-6 w-full max-w-sm space-y-4" style={{ background: '#443c3a' }}>
            <h2 className="text-xl font-black">End game?</h2>
            <p className="text-sm" style={{ color: '#8fa5a8' }}>This will finalize stats and take you to the summary screen.</p>
            <div className="space-y-2">
              <button
                onClick={handleEndGame}
                className="w-full text-white font-bold py-4 rounded-2xl active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #f8406d, #d11d4b)' }}
              >
                End Game & See Stats
              </button>
              <button
                onClick={() => setShowEnd(false)}
                className="w-full py-3 text-sm"
                style={{ color: '#8fa5a8' }}
              >
                Keep playing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
