import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { getGame, getRoster } from '../lib/storage';
import ShareGraphic from '../components/ShareGraphic';
import { statEmoji } from '../lib/voiceParser';

const STATS = ['goals', 'killerGoals', 'golasos', 'oles', 'megs'];
const LABELS = { goals: 'Goals', killerGoals: 'Killers', golasos: 'Golasos', oles: 'Oles', megs: 'Megs' };

function totalScore(s) {
  if (!s) return 0;
  return (s.golasos ?? 0) * 3 + (s.killerGoals ?? 0) * 2 + (s.goals ?? 0) + (s.oles ?? 0) + (s.megs ?? 0);
}

export default function Summary() {
  const { gameId } = useParams();
  const navigate   = useNavigate();
  const graphicRef = useRef(null);
  const [game,     setGame]      = useState(null);
  const [roster,   setRoster]    = useState([]);
  const [sharing,  setSharing]   = useState(false);
  const [imgUrl,   setImgUrl]    = useState(null);
  const [showImg,  setShowImg]   = useState(false);

  useEffect(() => {
    const g = getGame(gameId);
    if (!g) { navigate('/'); return; }
    setGame(g);
    setRoster(getRoster());
  }, [gameId]);

  async function generateImage() {
    if (!graphicRef.current) return null;
    const canvas = await html2canvas(graphicRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL('image/png');
  }

  async function handleShare() {
    setSharing(true);
    try {
      const dataUrl = await generateImage();
      setImgUrl(dataUrl);

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'streetfc-recap.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Streetfc Match Recap' });
      } else {
        // Fallback: show download button
        setShowImg(true);
      }
    } catch (err) {
      if (err.name !== 'AbortError') setShowImg(true);
    } finally {
      setSharing(false);
    }
  }

  async function handleDownload() {
    const dataUrl = imgUrl ?? await generateImage();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'streetfc-recap.png';
    a.click();
  }

  if (!game) return null;

  const entries = Object.entries(game.stats)
    .map(([id, s]) => ({ player: roster.find(p => p.id === id), stats: s }))
    .filter(e => e.player)
    .sort((a, b) => totalScore(b.stats) - totalScore(a.stats));

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-14 pb-5 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-400 text-xl p-1">←</button>
        <div className="flex-1">
          <h1 className="text-2xl font-black">Match Recap</h1>
          <p className="text-sm text-gray-400">
            {new Date(game.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </header>

      <main className="px-5 pb-10 flex-1 space-y-5">

        {/* Hidden graphic for capture */}
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
          <ShareGraphic game={game} roster={roster} graphicRef={graphicRef} />
        </div>

        {/* Leaderboard */}
        <section>
          {/* Column headers */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="flex-1" />
            <div className="flex gap-1" style={{ minWidth: 160 }}>
              {STATS.map(k => (
                <span key={k} className="flex-1 text-center text-base">{statEmoji(k)}</span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {entries.map(({ player, stats: s }, i) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${
                  i === 0 ? 'bg-emerald-500/15 border border-emerald-500/40' : 'bg-gray-800'
                }`}
              >
                <span className={`text-xs font-bold w-4 flex-shrink-0 ${i === 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {i + 1}
                </span>
                <span className={`flex-1 font-semibold text-sm truncate ${i === 0 ? 'text-emerald-100' : ''}`}>
                  {i === 0 && '👑 '}{player.name}
                </span>
                <div className="flex gap-1" style={{ minWidth: 160 }}>
                  {STATS.map(k => (
                    <span
                      key={k}
                      className={`flex-1 text-center text-sm font-bold ${
                        (s[k] ?? 0) > 0 ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {s[k] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {STATS.map(k => (
            <span key={k} className="text-xs text-gray-500">{statEmoji(k)} {LABELS[k]}</span>
          ))}
        </div>

        {/* Preview of graphic */}
        {showImg && imgUrl && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Share Graphic</p>
            <img src={imgUrl} alt="Match recap" className="w-full rounded-2xl" />
          </div>
        )}

        {/* Share buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full bg-emerald-500 disabled:bg-gray-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-base"
          >
            {sharing ? (
              <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
            ) : (
              <><span>📤</span> Share Recap</>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="w-full bg-gray-800 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <span>⬇️</span> Save Image
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full text-gray-400 text-sm py-2"
          >
            Back to home
          </button>
        </div>
      </main>
    </div>
  );
}
