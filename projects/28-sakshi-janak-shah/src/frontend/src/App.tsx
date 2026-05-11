import { useEffect, useRef, useState } from "react";
import { AuthForm } from "./components/AuthForm";
import { Dashboard } from "./components/Dashboard";
import { JournalForm } from "./components/JournalForm";
import { ReflectionCard } from "./components/ReflectionCard";
import { UserProfileForm } from "./components/UserProfileForm";
import { WeeklyStrategy } from "./components/WeeklyStrategy";
import {
  analyzeEntry,
  clearStoredToken,
  fetchCurrentUser,
  fetchDashboard,
  fetchEntries,
  fetchUserProfile,
  generateWeeklyStrategy,
  getStoredToken,
  login,
  logout,
  register,
  saveUserProfile,
  storeToken,
} from "./services/journalApi";
import type { AnalysisResult, AuthUser, DashboardSummary, JournalEntry, UserProfile } from "./types";

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [latestResult, setLatestResult] = useState<AnalysisResult | null>(null);
  const [weeklyHint, setWeeklyHint] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [weeklyStrategyError, setWeeklyStrategyError] = useState<string | null>(null);
  const reflectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      setProfile(null);
      setEntries([]);
      setLatestResult(null);
      setWeeklyHint(null);
      setDashboardSummary(null);
      return;
    }

    let active = true;
    const token = authToken;

    async function loadAuthenticatedApp() {
      setError(null);
      setSuccessMessage(null);
      setWeeklyStrategyError(null);

      try {
        const user = await fetchCurrentUser(token);
        if (!active) {
          return;
        }

        setCurrentUser(user);

        const [profileResponse, storedEntries, dashboard] = await Promise.all([
          fetchUserProfile(token),
          fetchEntries(token),
          fetchDashboard(token),
        ]);

        if (!active) {
          return;
        }

        setProfile(profileResponse.profile);
        setEntries(storedEntries);
        setLatestResult(storedEntries[0]?.result ?? null);
        setDashboardSummary(dashboard);
      } catch (loadError) {
        if (!active) {
          return;
        }

        clearStoredToken();
        setAuthToken(null);
        setCurrentUser(null);
        setProfile(null);
        setEntries([]);
        setLatestResult(null);
        setWeeklyHint(null);
        setDashboardSummary(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load your account.");
      }
    }

    void loadAuthenticatedApp();

    return () => {
      active = false;
    };
  }, [authToken]);

  async function handleLogin(payload: { email: string; password: string }) {
    setIsAuthBusy(true);
    setError(null);

    try {
      const response = await login(payload.email, payload.password);
      storeToken(response.token);
      setAuthToken(response.token);
      setCurrentUser(response.user);
      setSuccessMessage("Welcome back. Your journal is ready.");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to sign in.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleRegister(payload: { email: string; password: string }) {
    setIsAuthBusy(true);
    setError(null);

    try {
      const response = await register(payload.email, payload.password);
      storeToken(response.token);
      setAuthToken(response.token);
      setCurrentUser(response.user);
      setSuccessMessage("Account created. You can personalize your journal now.");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to create account.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleLogout() {
    if (!authToken) {
      return;
    }

    try {
      await logout(authToken);
    } catch {
      // We still clear the local session even if the backend session is already gone.
    }

    clearStoredToken();
    setAuthToken(null);
    setCurrentUser(null);
    setProfile(null);
    setEntries([]);
    setLatestResult(null);
    setWeeklyHint(null);
    setDashboardSummary(null);
    setSuccessMessage("You have been logged out.");
    setWeeklyStrategyError(null);
  }

  async function handleAnalyze(payload: { text: string; date: string }) {
    if (!authToken) {
      setError("Please sign in before analyzing an entry.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const entry = await analyzeEntry(authToken, payload.text, payload.date);
      setLatestResult(entry.result);
      setWeeklyHint(entry.result.weeklyHint);
      setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
      setSuccessMessage("Analysis generated and entry saved.");

      try {
        const [nextEntries, dashboard] = await Promise.all([
          fetchEntries(authToken),
          fetchDashboard(authToken),
        ]);
        setEntries(nextEntries);
        setDashboardSummary(dashboard);
      } catch {
        setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
      }

      window.setTimeout(() => {
        reflectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Unable to analyze entry.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGenerateWeeklyStrategy() {
    if (!authToken) {
      setWeeklyStrategyError("Please sign in before generating a weekly strategy.");
      return;
    }

    setIsGeneratingStrategy(true);
    setWeeklyStrategyError(null);

    try {
      setError(null);
      setWeeklyHint(await generateWeeklyStrategy(authToken));
    } catch (strategyError) {
      setWeeklyStrategyError(
        strategyError instanceof Error ? strategyError.message : "Unable to generate strategy."
      );
    } finally {
      setIsGeneratingStrategy(false);
    }
  }

  async function handleSaveProfile(nextProfile: UserProfile) {
    if (!authToken || !currentUser) {
      setError("Please sign in before saving your profile.");
      return;
    }

    setIsSavingProfile(true);
    setError(null);

    try {
      const saved = await saveUserProfile(authToken, {
        ...nextProfile,
        user_id: currentUser.id,
      });
      setProfile(saved);
      setSuccessMessage("Profile saved. New journal analysis will use this context.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">MindJournal</p>
          <h1>Reflect. Understand. Improve.</h1>
          <p>
            A calmer journaling space with personalized AI analysis, profile-aware insights, and a
            dashboard that turns your entries into patterns you can act on.
          </p>
        </div>
        {currentUser ? (
          <div className="session-card">
            <p className="session-label">Signed in</p>
            <strong>{currentUser.email}</strong>
            <button className="secondary-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : null}
      </header>

      <main className="main-grid">
        {error ? <section className="banner-error">{error}</section> : null}
        {successMessage ? <section className="banner-success">{successMessage}</section> : null}

        {!authToken || !currentUser ? (
          <AuthForm onLogin={handleLogin} onRegister={handleRegister} isBusy={isAuthBusy} />
        ) : (
          <>
            <UserProfileForm
              profile={profile}
              userEmail={currentUser.email}
              onSave={handleSaveProfile}
              isSaving={isSavingProfile}
            />
            <JournalForm onAnalyze={handleAnalyze} isBusy={isBusy} />
            <div ref={reflectionRef}>
              <ReflectionCard result={latestResult} />
            </div>
            <Dashboard summary={dashboardSummary} />
            <WeeklyStrategy
              weeklyHint={weeklyHint}
              onGenerate={handleGenerateWeeklyStrategy}
              disabled={!entries.length}
              isLoading={isGeneratingStrategy}
              error={weeklyStrategyError}
            />
          </>
        )}
      </main>
    </div>
  );
}
