import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoster, saveRoster, addPlayer, removePlayer } from '../lib/storage';

// ─── Roster screenshot → names via Claude Vision ─────────────────────────────
// Calls the Anthropic API client-side. Requires VITE_ANTHROPIC_API_KEY.
async function extractNamesFromImage(base64Image, mimeType) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set in .env');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: `This is a player RSVP list from a sports app (likely Glory Days or similar). Each row has a profile photo on the left, a player name in the middle, and stats on the right (things like "24x ⚽", "K·3.07", "4 days ago" — ignore all of that).

Extract ONLY the player names. Names are formatted as "First LastInitial." (e.g. "Izaak C.", "Alejandro V."). Keep the last initial and period exactly as shown.

Return a plain list — one name per line, nothing else. No bullet points, no numbers, no stats, no section headers like "RSVPs" or "Waitlist".`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return text
    .split('\n')
    .map(l => l.trim().replace(/^[-•*\d.]+\s*/, ''))
    .filter(l => l.length > 1);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:mime;base64,xxx
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Roster() {
  const navigate  = useNavigate();
  const fileRef   = useRef();
  const [roster,    setRoster]    = useState([]);
  const [name,      setName]      = useState('');
  const [number,    setNumber]    = useState('');
  const [tab,       setTab]       = useState('manual'); // 'manual' | 'csv' | 'photo'
  const [csvText,   setCsvText]   = useState('');
  const [photoState, setPhotoState] = useState('idle'); // 'idle'|'loading'|'preview'|'error'
  const [photoNames, setPhotoNames] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [photoChecked, setPhotoChecked] = useState({});

  useEffect(() => { setRoster(getRoster()); }, []);

  function refresh() { setRoster(getRoster()); }

  // ── Manual add ──────────────────────────────────────────────────────────────
  function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    addPlayer(name, number);
    setName(''); setNumber('');
    refresh();
  }

  // ── CSV import ──────────────────────────────────────────────────────────────
  function importCSV() {
    const lines = csvText.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
    lines.forEach(l => addPlayer(l));
    setCsvText('');
    refresh();
  }

  // ── Photo import ─────────────────────────────────────────────────────────────
  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoState('loading');
    setPhotoError('');
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const names = await extractNamesFromImage(base64, mimeType);
      setPhotoNames(names);
      const checked = {};
      names.forEach(n => { checked[n] = true; });
      setPhotoChecked(checked);
      setPhotoState('preview');
    } catch (err) {
      setPhotoError(err.message);
      setPhotoState('error');
    }
    e.target.value = '';
  }

  function addPhotoPlayers() {
    photoNames.filter(n => photoChecked[n]).forEach(n => addPlayer(n));
    setPhotoState('idle');
    setPhotoNames([]);
    refresh();
  }

  // ── Remove ───────────────────────────────────────────────────────────────────
  function handleRemove(id) {
    removePlayer(id);
    refresh();
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-400 text-xl p-1">←</button>
        <div>
          <h1 className="text-2xl font-black">Roster</h1>
          <p className="text-gray-400 text-sm">{roster.length} players</p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 px-5 mb-5">
        {[
          { key: 'manual', label: 'Add Player' },
          { key: 'csv',    label: 'Paste List' },
          { key: 'photo',  label: '📷 Screenshot' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-5 pb-10 space-y-5">
        {/* ── Manual add ── */}
        {tab === 'manual' && (
          <form onSubmit={handleAdd} className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Player name"
              className="w-full bg-gray-800 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 text-base"
            />
            <div className="flex gap-3">
              <input
                value={number}
                onChange={e => setNumber(e.target.value)}
                placeholder="# (optional)"
                className="w-24 bg-gray-800 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 text-base"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all"
              >
                Add Player
              </button>
            </div>
          </form>
        )}

        {/* ── CSV paste ── */}
        {tab === 'csv' && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-gray-400">Paste names separated by newlines or commas.</p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={"John Doe\nMike Smith\nCarlos Ruiz"}
              rows={6}
              className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 text-base resize-none"
            />
            <button
              onClick={importCSV}
              disabled={!csvText.trim()}
              className="w-full bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all"
            >
              Import Names
            </button>
          </div>
        )}

        {/* ── Photo import ── */}
        {tab === 'photo' && (
          <div className="space-y-4">
            {photoState === 'idle' && (
              <div className="bg-gray-900 rounded-2xl p-6 text-center space-y-4">
                <p className="text-4xl">📷</p>
                <p className="font-semibold">Upload a roster screenshot</p>
                <p className="text-sm text-gray-400">Claude will read the player names automatically. Works with group chats, team sheets, or any roster image.</p>
                {!import.meta.env.VITE_ANTHROPIC_API_KEY && (
                  <p className="text-xs text-amber-400 bg-amber-400/10 rounded-xl px-3 py-2">
                    Requires <code>VITE_ANTHROPIC_API_KEY</code> in your <code>.env</code> file.
                  </p>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-all"
                >
                  Choose Photo
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            )}

            {photoState === 'loading' && (
              <div className="bg-gray-900 rounded-2xl p-8 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400">Reading roster…</p>
              </div>
            )}

            {photoState === 'error' && (
              <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
                <p className="text-red-400 font-semibold">Could not read roster</p>
                <p className="text-sm text-gray-400">{photoError}</p>
                <button
                  onClick={() => { setPhotoState('idle'); fileRef.current?.click(); }}
                  className="w-full bg-gray-800 text-white font-semibold py-3 rounded-xl active:scale-95 transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

            {photoState === 'preview' && (
              <div className="bg-gray-900 rounded-2xl overflow-hidden">
                <div className="px-4 py-4 border-b border-gray-800">
                  <p className="font-bold">Found {photoNames.length} players</p>
                  <p className="text-sm text-gray-400">Uncheck anyone to skip.</p>
                </div>
                <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
                  {photoNames.map(n => (
                    <label key={n} className="flex items-center gap-3 px-4 py-3 active:bg-gray-800">
                      <input
                        type="checkbox"
                        checked={!!photoChecked[n]}
                        onChange={e => setPhotoChecked(c => ({ ...c, [n]: e.target.checked }))}
                        className="w-5 h-5 accent-emerald-500"
                      />
                      <span className="text-sm font-medium">{n}</span>
                    </label>
                  ))}
                </div>
                <div className="px-4 py-4 border-t border-gray-800 space-y-2">
                  <button
                    onClick={addPhotoPlayers}
                    className="w-full bg-emerald-500 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all"
                  >
                    Add {Object.values(photoChecked).filter(Boolean).length} Players
                  </button>
                  <button
                    onClick={() => setPhotoState('idle')}
                    className="w-full text-gray-400 text-sm py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Roster list ── */}
        {roster.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Players</h2>
            <div className="space-y-2">
              {roster.map(p => (
                <div
                  key={p.id}
                  className="bg-gray-800 rounded-2xl px-4 py-3.5 flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {p.number ? `#${p.number}` : p.name[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <button
                    onClick={() => handleRemove(p.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xl w-8 h-8 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
