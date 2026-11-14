import React, { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "./api";
import { authStorage } from "./storage";

interface SessionIdentity {
  uid: string;
  role: string;
  familyId?: string;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  role: string | null;
  /** Human-readable EOTC uid used for login/claim. */
  eotcUid: string | null;
  /** Firebase Auth uid — matches `senderId` on Firestore messages. */
  uid: string | null;
  familyId: string | null;
  login: (eotcUid: string, password: string) => Promise<{ role: string }>;
  claim: (
    eotcUid: string,
    password: string,
    email: string,
    role?: string
  ) => Promise<{ role: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [eotcUid, setEotcUid] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  /**
   * Fetch the authoritative identity from the server. Used after login/claim
   * (which return the uid but not familyId) and to repair sessions persisted
   * by older app versions that only stored the EOTC uid.
   */
  const hydrateIdentity = async (): Promise<SessionIdentity | null> => {
    try {
      const session = await apiRequest<SessionIdentity & { success: boolean }>(
        "/api/auth/session"
      );

      setUid(session.uid);
      setRole(session.role);
      setFamilyId(session.familyId ?? null);

      const meta = await authStorage.getUserMeta();
      await authStorage.saveUserMeta(
        session.role,
        meta.eotcUid ?? undefined,
        session.uid,
        session.familyId
      );

      return session;
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;

      // A rejected token means the session is genuinely dead.
      if (status === 401) {
        await authStorage.clear();
        setIsAuthenticated(false);
        setRole(null);
        setEotcUid(null);
        setUid(null);
        setFamilyId(null);
        return null;
      }

      // Network/offline: keep the cached identity so the app stays usable.
      console.warn("Identity hydration skipped:", error);
      return null;
    }
  };

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const token = await authStorage.getToken();
        const meta = await authStorage.getUserMeta();

        if (!token || !meta.role) {
          setIsAuthenticated(false);
          setRole(null);
          setEotcUid(null);
          setUid(null);
          setFamilyId(null);
          return;
        }

        setIsAuthenticated(true);
        setRole(meta.role);
        setEotcUid(meta.eotcUid);
        setUid(meta.uid);
        setFamilyId(meta.familyId);

        // Older installs persisted no Firebase uid / familyId. Repair in the
        // background so startup never blocks on the network.
        if (!meta.uid || !meta.familyId) {
          hydrateIdentity().catch(() => {});
        }
      } catch (e) {
        console.error("Failed to load stored session:", e);
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (eotcId: string, password: string) => {
    const formattedUid = eotcId.trim().toUpperCase();
    const res = await apiRequest<{
      success: boolean;
      role: string;
      uid?: string;
      token?: string;
    }>("/api/auth/login", {
      method: "POST",
      requiresAuth: false,
      body: JSON.stringify({
        eotcUid: formattedUid,
        password,
      }),
    });

    if (!res.token) {
      throw new Error("የመግቢያ ቶከን አልተገኘም። እባክዎ እንደገና ይሞክሩ።");
    }

    await authStorage.saveToken(res.token);
    await authStorage.saveUserMeta(res.role, formattedUid, res.uid);

    setIsAuthenticated(true);
    setRole(res.role);
    setEotcUid(formattedUid);
    setUid(res.uid ?? null);

    // Best-effort: fills in familyId for the session.
    await hydrateIdentity();

    return { role: res.role };
  };

  const claim = async (
    eotcId: string,
    password: string,
    email: string,
    roleHint?: string
  ) => {
    const formattedUid = eotcId.trim().toUpperCase();
    const res = await apiRequest<{
      success: boolean;
      role?: string;
      uid?: string;
      token?: string;
    }>("/api/auth/claim", {
      method: "POST",
      requiresAuth: false,
      body: JSON.stringify({
        eotcUid: formattedUid,
        password,
        email: email.trim().toLowerCase(),
        ...(roleHint ? { role: roleHint } : {}),
      }),
    });

    // The server is the source of truth for the role: the gateway preview may
    // not have known it, and defaulting to STUDENT would mislabel fathers.
    const userRole = res.role || roleHint;
    if (!userRole) {
      throw new Error("መለያውን ማረጋገጥ አልተቻለም");
    }
    if (!res.token) {
      throw new Error("የመግቢያ ቶከን አልተገኘም። እባክዎ እንደገና ይሞክሩ።");
    }

    await authStorage.saveToken(res.token);
    await authStorage.saveUserMeta(userRole, formattedUid, res.uid);

    setIsAuthenticated(true);
    setRole(userRole);
    setEotcUid(formattedUid);
    setUid(res.uid ?? null);

    // Best-effort: fills in familyId for the session.
    await hydrateIdentity();

    return { role: userRole };
  };

  const logout = async () => {
    try {
      // Stop pushes to this device before the token is invalidated.
      await apiRequest("/api/notifications/fcm", {
        method: "DELETE",
      }).catch(() => {});

      await apiRequest("/api/auth/logout", {
        method: "POST",
        requiresAuth: true,
      }).catch(() => {});
    } finally {
      await authStorage.clear();
      setIsAuthenticated(false);
      setRole(null);
      setEotcUid(null);
      setUid(null);
      setFamilyId(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        role,
        eotcUid,
        uid,
        familyId,
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
