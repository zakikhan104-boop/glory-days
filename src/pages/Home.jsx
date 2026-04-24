import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoster, getGames, createGame } from '../lib/storage';

export default function Home() {
  const navigate = useNavigate();
  const [roster, setRoster]   = useState([]);
  const [games,  setGames]    = useState([]);
  const [selected, setSelected] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    setRoster(getRoster());
    setGames(getGames().slice().reverse());
  }, []);

  function togglePlayer(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function startGame() {
    if (selected.length === 0) return;
    const game = createGame(selected);
    navigate(`/game/${game.id}`);
  }

  const activeGames  = games.filter(g => !g.ended);
  const finishedGames = games.filter(g => g.ended);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-14 pb-6">
        <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase mb-1">Streetfc</p>
        <h1 className="text-4xl font-black">Scoreboard</h1>
      </header>

      <main className="flex-1 px-5 space-y-6 pb-10">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowPicker(true)}
            className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all rounded-2xl p-5 text-left"
          >
            <span className="text-3xl block mb-2">⚽</span>
            <span className="font-bold text-lg leading-tight">New Game</span>
          </button>
          <button
            onClick={() => navigate('/roster')}
            className="bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl p-5 text-left"
          >
            <span className="text-3xl block mb-2">👥</span>
            <span className="font-bold text-lg leading-tight">Roster</span>
            <span className="text-gray-400 text-sm block">{roster.length} players</span>
          </button>
        </div>

        {/* Active games */}
        {activeGames.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">In Progress</h2>
            <div className="space-y-2">
              {activeGames.map(g => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/game/${g.id}`)}
                  className="w-full bg-gray-800 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-95 transition-all"
                >
                  <div className="text-left">
                    <p className="font-semibold">{new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    <p className="text-sm text-gray-400">{Object.keys(g.stats).length} players</p>
                  </div>
                  <span className="text-emerald-400 font-bold text-sm">Resume →</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Past games */}
        {finishedGames.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Past Games</h2>
            <div className="space-y-2">
              {finishedGames.slice(0, 5).map(g => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/summary/${g.id}`)}
                  className="w-full bg-gray-800 rounded-2xl px-4 py-4 flex items-center justify-between active:scale-95 transition-all"
                >
                  <div className="text-left">
                    <p className="font-semibold">{new Date(g.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="text-sm text-gray-400">{Object.keys(g.stats).length} players</p>
                  </div>
                  <span className="text-gray-400 text-sm">Stats →</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {roster.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No players yet. Set up your roster first.</p>
            <button
              onClick={() => navigate('/roster')}
              className="bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl active:scale-95 transition-all"
            >
              Set Up Roster
            </button>
          </div>
        )}
      </main>

      {/* Player Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end">
          <div className="bg-gray-900 rounded-t-3xl w-full max-h-[85vh] flex flex-col">
            <div className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-gray-800">
              <div>
                <h2 className="text-xl font-bold">Who's playing?</h2>
                <p className="text-sm text-gray-400">{selected.length} selected</p>
              </div>
              <button onClick={() => { setShowPicker(false); setSelected([]); }} className="text-gray-400 text-2xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {roster.length === 0 && (
                <p className="text-gray-400 text-center py-8">No players on roster. Add some first.</p>
              )}
              {roster.map(p => {
                const active = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`w-full flex items-center gap-4 rounded-2xl px-4 py-4 transition-all active:scale-95 ${
                      active ? 'bg-emerald-500/20 border border-emerald-500' : 'bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      active ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {active ? '✓' : (p.number || p.name[0]?.toUpperCase())}
                    </div>
                    <span className="font-semibold text-left flex-1">{p.name}</span>
                    {p.number && <span className="text-gray-400 text-sm">#{p.number}</span>}
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-5 border-t border-gray-800 space-y-3">
              <button
                onClick={startGame}
                disabled={selected.length === 0}
                className="w-full bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-lg py-4 rounded-2xl active:scale-95 transition-all"
              >
                Start Game {selected.length > 0 ? `(${selected.length})` : ''}
              </button>
              <button
                onClick={() => { navigate('/roster'); setShowPicker(false); }}
                className="w-full text-gray-400 text-sm py-2"
              >
                Add players to roster →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
