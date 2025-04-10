'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
}

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
  });

  const checkTokenValidity = useCallback(() => {
    if (typeof window === 'undefined') return false; // 服务器端渲染时不执行

    const token = localStorage.getItem('auth_token');
    const timestamp = localStorage.getItem('token_timestamp');

    if (!token || !timestamp) {
      return false;
    }

    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > TOKEN_EXPIRY) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_timestamp');
      return false;
    }

    return true;
  }, []);

  // 初始化时检查登录状态
  useEffect(() => {
    const isValid = checkTokenValidity();
    const token = isValid ? localStorage.getItem('auth_token') : null;

    setAuthState({
      isAuthenticated: isValid,
      token,
    });
  }, [checkTokenValidity]);

  const login = useCallback((token: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('token_timestamp', Date.now().toString());
    setAuthState({
      isAuthenticated: true,
      token,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token_timestamp');
    setAuthState({
      isAuthenticated: false,
      token: null,
    });
  }, []);

  return {
    ...authState,
    login,
    logout,
    checkTokenValidity,
  };
};