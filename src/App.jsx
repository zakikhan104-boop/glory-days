import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home    from './pages/Home';
import Roster  from './pages/Roster';
import Game    from './pages/Game';
import Summary from './pages/Summary';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                element={<Home />} />
        <Route path="/roster"          element={<Roster />} />
        <Route path="/game/:gameId"    element={<Game />} />
        <Route path="/summary/:gameId" element={<Summary />} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
