import { useState } from "react";

interface AuthFormProps {
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onRegister: (payload: { email: string; password: string }) => Promise<void>;
  isBusy: boolean;
}

type AuthMode = "login" | "register";

export function AuthForm({ onLogin, onRegister, isBusy }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);

    if (mode === "login") {
      await onLogin({ email: trimmedEmail, password });
      return;
    }

    await onRegister({ email: trimmedEmail, password });
  }

  return (
    <section className="panel auth-panel">
      <div className="section-heading">
        <p className="eyebrow">Account</p>
        <h2>Sign in to your journal</h2>
      </div>

      <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
        <button
          className={mode === "login" ? "toggle-button active" : "toggle-button"}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        <button
          className={mode === "register" ? "toggle-button active" : "toggle-button"}
          onClick={() => setMode("register")}
          type="button"
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {mode === "register" ? (
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
        ) : null}

        {error ? <p className="inline-message error">{error}</p> : null}

        <button className="primary-button" type="submit" disabled={isBusy}>
          {isBusy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>
    </section>
  );
}
