import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode
} from "react";
import { api } from "../../shared/apiClient";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  walletBalance: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
};

const TOKEN_KEY = "csm_token";

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
  );
  const [isLoading, setIsLoading] = useState(true);

  const persistToken = useCallback((t: string | null) => {
    setToken(t);
    if (typeof window !== "undefined") {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const fetchMe = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const u = await api.get<AuthUser>("/auth/me");
      setUser(u);
    } catch {
      persistToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [persistToken]);

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [token, fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ user: AuthUser; token: string }>(
        "/auth/login",
        { email, password }
      );
      persistToken(res.token);
      setUser(res.user);
    },
    [persistToken]
  );

  const signup = useCallback(
    async (email: string, name: string, password: string) => {
      const res = await api.post<{ user: AuthUser; token: string }>(
        "/auth/signup",
        { email, name, password }
      );
      persistToken(res.token);
      setUser(res.user);
    },
    [persistToken]
  );

  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
  }, [persistToken]);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    login,
    signup,
    logout,
    fetchMe
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
