import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthState {
  token: string | null;
  email: string | null;
  userId: number | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (auth: AuthState) => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: null, email: null, userId: null,
  setAuth: () => {}, logout: () => {}, isLoggedIn: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>(() => {
    try {
      const raw = localStorage.getItem("heartguard_auth");
      return raw ? JSON.parse(raw) : { token: null, email: null, userId: null };
    } catch {
      return { token: null, email: null, userId: null };
    }
  });

  const setAuth = (next: AuthState) => {
    setAuthState(next);
    localStorage.setItem("heartguard_auth", JSON.stringify(next));
  };

  const logout = () => {
    setAuthState({ token: null, email: null, userId: null });
    localStorage.removeItem("heartguard_auth");
  };

  return (
    <AuthContext.Provider value={{ ...auth, setAuth, logout, isLoggedIn: !!auth.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
