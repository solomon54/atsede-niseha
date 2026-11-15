import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { apiRequest } from "./api";
import { authEvents } from "./auth-events";
import { offlineCache } from "./cache";
import { authStorage } from "./storage";

interface SessionIdentity {
  uid: string;
  role: string;
  familyId?: string;
  eotcUid?: string;
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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [eotcUid, setEotcUid] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const lastRefreshAt = useRef(0);

  /**
   * Slide the session forward while it is still valid. Safe to call on cold
   * start and on foreground; a dead session is handled by the 401 listener.
   */
  const refreshSession = async (): Promise<void> => {
    try {
      let res: {
        success?: boolean;
        token?: string;
        role?: string;
        uid?: string;
        familyId?: string;
      } | null = null;

      try {
        res = await apiRequest<{
          success: boolean;
          token?: string;
          role?: string;
          uid?: string;
          familyId?: string;
        }>("/api/auth/refresh", { method: "POST" });
      } catch (err: any) {
        // Fallback to GET /api/auth/refresh if backend only has GET deployed
        if (err?.status === 405) {
          res = await apiRequest<{
            success: boolean;
            role?: string;
            uid?: string;
            familyId?: string;
          }>("/api/auth/refresh", { method: "GET" });
        } else {
          throw err;
        }
      }

      if (!res) return;

      const meta = await authStorage.getUserMeta();
      if (res.token) {
        await authStorage.saveToken(res.token);
      }

      if (res.role && res.uid) {
        await authStorage.saveUserMeta(
          res.role,
          meta.eotcUid ?? undefined,
          res.uid,
          res.familyId
        );
        setRole(res.role);
        setUid(res.uid);
        setFamilyId(res.familyId ?? null);
      }

      lastRefreshAt.current = Date.now();
    } catch (error) {
      // 401s already cleared the session via the auth event.
      console.warn("Session refresh skipped:", error);
    }
  };

  /**
   * A 401 from any API call clears the dead token and returns to the gateway
   * instead of leaving the user on a screen that can never load.
   */
  useEffect(() => {
    return authEvents.onUnauthorized(() => {
      setIsAuthenticated(false);
      setRole(null);
      setEotcUid(null);
      setUid(null);
      setFamilyId(null);
      // A rejected session means this device must not keep pastoral data.
      offlineCache.clearAll().catch(() => {});
      router.replace("/(auth)/login");
    });
  }, [router]);

  /**
   * Fetch the authoritative identity from the server. Used after login/claim
   * (which return the uid but not familyId) and to repair sessions persisted
   * by older app versions that only stored the EOTC uid.
   */
  const hydrateIdentity = async (): Promise<SessionIdentity | null> => {
    try {
      let session: (SessionIdentity & { success?: boolean }) | null = null;

      try {
        session = await apiRequest<SessionIdentity & { success: boolean }>(
          "/api/auth/session"
        );
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        // Fallback to /api/auth/refresh if /api/auth/session is 404
        if (status === 404) {
          session = await apiRequest<SessionIdentity & { success: boolean }>(
            "/api/auth/refresh"
          );
        } else {
          throw err;
        }
      }

      if (!session?.uid || !session?.role) return null;

      setUid(session.uid);
      setRole(session.role);
      setFamilyId(session.familyId ?? null);
      if (session.eotcUid) {
        setEotcUid(session.eotcUid);
      }

      const meta = await authStorage.getUserMeta();
      const resolvedEotcUid = session.eotcUid || meta.eotcUid || undefined;
      await authStorage.saveUserMeta(
        session.role,
        resolvedEotcUid,
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

        // Slide the 5-day session forward on launch.
        lastRefreshAt.current = Date.now();
        refreshSession().catch(() => {});
      } catch (e) {
        console.error("Failed to load stored session:", e);
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh when the app returns to the foreground after a long pause, so a
  // session cannot expire while the app sits in the background for days.
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (Date.now() - lastRefreshAt.current < 12 * 60 * 60 * 1000) return;
      refreshSession().catch(() => {});
    });

    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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

    // A login can switch accounts without an explicit logout. Cached reads and
    // cursors belong to the previous account; the outbox is account-scoped and
    // is deliberately preserved.
    await offlineCache.clearAll().catch(() => {});

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

    // See login(): isolate the newly authenticated account while keeping its
    // previous pending outbox operations available for replay.
    await offlineCache.clearAll().catch(() => {});

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
      // Shared devices must not retain the previous user's cached snapshots.
      await offlineCache.clearAll().catch(() => {});
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
