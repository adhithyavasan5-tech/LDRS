import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userService } from '../services/userService';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ldrs_token';
const USER_KEY = 'ldrs_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Verify token on mount and refresh user data
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        setInitialized(true);
        return;
      }

      try {
        const response = await userService.getMyProfile();
        if (response.success) {
          setUser(response.user);
          localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        } else {
          // Token invalid — clear session
          clearSession();
        }
      } catch (err) {
        // Network error — keep existing cached user
        console.warn('[Auth] Session verification failed (possibly offline):', err.message);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    verifySession();
  }, []);

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, []);

  const clearSession = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const updateUser = useCallback((updatedUser) => {
    const merged = { ...user, ...updatedUser };
    setUser(merged);
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
  }, [user]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        initialized,
        isAuthenticated,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
