import React, { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "./api";
import { authStorage } from "./storage";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  role: string | null;
  eotcUid: string | null;
  login: (eotcUid: string, password: string) => Promise<{ role: string }>;
  claim: (eotcUid: string, password: string, email: string) => Promise<{ role: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [eotcUid, setEotcUid] = useState<string | null>(null);

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const token = await authStorage.getToken();
        const meta = await authStorage.getUserMeta();

        if (token && meta.role) {
          setIsAuthenticated(true);
          setRole(meta.role);
          setEotcUid(meta.eotcUid);
        } else {
          setIsAuthenticated(false);
          setRole(null);
          setEotcUid(null);
        }
      } catch (e) {
        console.error("Failed to load stored session:", e);
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredSession();
  }, []);

  const login = async (uid: string, password: string) => {
    const formattedUid = uid.trim().toUpperCase();
    const res = await apiRequest<{
      success: boolean;
      role: string;
      token?: string;
    }>("/api/auth/login", {
      method: "POST",
      requiresAuth: false,
      body: JSON.stringify({
        eotcUid: formattedUid,
        password,
      }),
    });

    if (res.token) {
      await authStorage.saveToken(res.token);
    }
    await authStorage.saveUserMeta(res.role, formattedUid);

    setIsAuthenticated(true);
    setRole(res.role);
    setEotcUid(formattedUid);

    return { role: res.role };
  };

  const claim = async (uid: string, password: string, email: string) => {
    const formattedUid = uid.trim().toUpperCase();
    const res = await apiRequest<{
      success: boolean;
      role?: string;
      token?: string;
    }>("/api/auth/claim", {
      method: "POST",
      requiresAuth: false,
      body: JSON.stringify({
        eotcUid: formattedUid,
        password,
        email: email.trim().toLowerCase(),
      }),
    });

    const userRole = res.role || "STUDENT";
    if (res.token) {
      await authStorage.saveToken(res.token);
    }
    await authStorage.saveUserMeta(userRole, formattedUid);

    setIsAuthenticated(true);
    setRole(userRole);
    setEotcUid(formattedUid);

    return { role: userRole };
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        requiresAuth: true,
      }).catch(() => {});
    } finally {
      await authStorage.clear();
      setIsAuthenticated(false);
      setRole(null);
      setEotcUid(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        role,
        eotcUid,
        login,
        claim,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

