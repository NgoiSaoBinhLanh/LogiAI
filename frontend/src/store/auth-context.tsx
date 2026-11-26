'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  API_BASE_URL,
  invalidateApiCache,
  registerUnauthorizedHandler,
  setAccessToken,
} from '../services/api';
import { AuthApi } from '../services/iam.service';
import { LoginPayload, UserProfile } from '../types/auth';

interface AuthContextValue {
  user: UserProfile | null;
  socket: Socket | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUserPermissions: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const RBAC_COOKIE_NAME = 'logai_rbac';

function syncRbacCookie(user: UserProfile | null): void {
  if (typeof document === 'undefined') return;
  if (!user) {
    document.cookie = `${RBAC_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  const compact = {
    uid: user.userId,
    roles: user.roles,
    perms: user.permissions,
    ver: user.permissionVersion,
  };
  const encoded = encodeURIComponent(JSON.stringify(compact));
  document.cookie = `${RBAC_COOKIE_NAME}=${encoded}; path=/; max-age=604800; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
    invalidateApiCache();
    syncRbacCookie(null);
  }, []);

  const refreshUserPermissions = useCallback(async () => {
    try {
      const res = await AuthApi.me();
      setUser(res.user);
      syncRbacCookie(res.user);
    } catch {
      // Nếu token hết hạn hoặc user bị khóa -> dọn session
    }
  }, []);

  // Khôi phục phiên khi tải lại trang qua HttpOnly Refresh Token Cookie
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearSession();
      router.push('/login');
    });

    let active = true;
    async function initSession() {
      const hasRbacCookie =
        typeof document !== 'undefined' &&
        document.cookie.split('; ').some((c) => c.startsWith(`${RBAC_COOKIE_NAME}=`));
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

      if (
        !hasRbacCookie &&
        (currentPath === '/' || currentPath.startsWith('/login') || currentPath.startsWith('/forgot-password'))
      ) {
        if (active) {
          clearSession();
          setLoading(false);
        }
        return;
      }

      try {
        const res = await AuthApi.refresh();
        if (!active) return;
        setAccessToken(res.accessToken);
        setToken(res.accessToken);
        setUser(res.user);
        syncRbacCookie(res.user);
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setLoading(false);
      }
    }
    initSession();
    return () => {
      active = false;
    };
  }, [clearSession, router]);

  // Kết nối WebSocket lắng nghe thay đổi phân quyền động tức thì (RBAC Realtime Sync)
  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      return;
    }
    const newSocket: Socket = io(API_BASE_URL, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('rbac:updated', () => {
      refreshUserPermissions();
      toast.info('Quyền truy cập của bạn vừa được quản trị viên cập nhật và áp dụng ngay.');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [token, user?.userId, refreshUserPermissions]);

  const login = useCallback(async (payload: LoginPayload): Promise<UserProfile> => {
    const res = await AuthApi.login(payload);
    setAccessToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    syncRbacCookie(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthApi.logout();
    } catch {
      // ignore
    } finally {
      clearSession();
      router.push('/login');
    }
  }, [clearSession, router]);

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) return false;
      if (user.roles.includes('ADMIN')) return true;
      return user.permissions.includes(code);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => {
      if (!user) return false;
      if (user.roles.includes('ADMIN')) return true;
      return codes.some((c) => user.permissions.includes(c));
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        socket,
        loading,
        login,
        logout,
        refreshUserPermissions,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
