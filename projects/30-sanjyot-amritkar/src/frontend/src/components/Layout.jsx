import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Button from './Button.jsx';
import HelpModal from './HelpModal.jsx';
import { resetAppState } from '../utils/resetAppState.js';

const tabClassName = ({ isActive }) =>
  `flex-1 whitespace-nowrap rounded-full px-4 py-2 text-center text-xs font-semibold transition ${
    isActive
      ? 'bg-slate-900 text-white shadow-sm'
      : 'text-slate-600 hover:text-slate-900'
  }`;

const Layout = ({ children, apiStatus = 'checking' }) => {
  const navigate = useNavigate();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleOpenReset = () => {
    setShowResetConfirm(true);
  };

  const handleCancelReset = () => {
    if (isResetting) return;
    setShowResetConfirm(false);
  };

  const handleConfirmReset = () => {
    if (isResetting) return;
    setIsResetting(true);
    resetAppState();

    // Hard reload to ensure all hooks re-read cleared storage and UI returns to
    // a true first-time state, avoiding any stale in-memory values.
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      // Fallback for non-browser environments.
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="px-4 pt-6 pb-4 bg-white/80 backdrop-blur border-b border-white/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link to="/" className="text-lg font-semibold text-slate-900">
                State-Aware Adaptive Fitness
              </Link>
              <p className="text-sm text-slate-600">
                Align workouts with how your body and mind feel today.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenReset}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                Reset app
              </button>
            </div>
          </div>
          <nav
            className="flex gap-2 rounded-full bg-slate-100/80 p-1 text-xs shadow-inner overflow-x-auto"
            aria-label="Primary navigation"
          >
            <NavLink to="/" end className={tabClassName}>
              Onboarding
            </NavLink>
            <NavLink to="/burnout" className={tabClassName}>
              Burnout Tracker
            </NavLink>
            <NavLink to="/workout" className={tabClassName}>
              Workout Planner
            </NavLink>
            <NavLink to="/dashboard" className={tabClassName}>
              Dashboard
            </NavLink>
            <NavLink to="/history" className={tabClassName}>
              History
            </NavLink>
          </nav>
          {apiStatus === 'error' && (
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-2 text-xs text-rose-700">
              Backend is unreachable. Some features may be unavailable.
            </div>
          )}
        </div>
      </header>
      <main className="px-4 py-8">
        <div className="max-w-3xl mx-auto">{children}</div>
      </main>
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur transition hover:border-indigo-200 hover:text-indigo-700"
        aria-label="Open help"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
          ?
        </span>
        <span>Help</span>
      </button>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      {showResetConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-900">Reset app data?</h2>
            <p className="mt-2 text-xs text-slate-600">
              This will clear onboarding, burnout history, workout history, latest workout plans, AI burnout
              insights, and other saved app data. This action cannot be undone.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={handleCancelReset} disabled={isResetting}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmReset} disabled={isResetting}>
                {isResetting ? 'Resetting…' : 'Reset App'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <footer className="px-4 py-6 text-xs text-slate-500">
        <div className="max-w-3xl mx-auto">
          Not a medical diagnostic tool. For informational purposes only.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
