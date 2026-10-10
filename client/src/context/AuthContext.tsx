// Keeps track of who is logged in and exposes login / logout to the whole app.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import type { User } from '../types';
import { AuthContext, type AuthContextValue } from './auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await authApi.getMe());
  }, []);

  useEffect(() => {
    authApi
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // The server refused a request with 401: the session is gone (e.g. the doctor was
  // deactivated, or the password was changed on another device). Forget the user,
  // so RequireRole sends them to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const loggedIn = await authApi.login({ email, password });
        setUser(loggedIn);
        return loggedIn;
      },
      async register(name, email, password) {
        const created = await authApi.register({ name, email, password });
        setUser(created);
        return created;
      },
      async logout() {
        await authApi.logout();
        setUser(null);
      },
      refresh,
    }),
    [user, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
