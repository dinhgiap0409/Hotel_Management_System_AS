import { createContext, useContext, useState } from 'react';
import { setAccessToken } from '../lib/http';
import { authApi } from '../services/authApi';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('hms_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setSession = (loginRes) => {
    setAccessToken(loginRes.accessToken);
    setUser(loginRes.user);
    if (loginRes.user) {
      localStorage.setItem('hms_user', JSON.stringify(loginRes.user));
    }
  };

  const clearSession = () => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('hms_user');
  };

  const login = async ({ email, password }) => {
    const res = await authApi.login(email, password);
    const payload = res.data || res;
    setSession(payload);
    return payload;
  };

  const logout = () => {
    clearSession();
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        setSession,
        clearSession,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}