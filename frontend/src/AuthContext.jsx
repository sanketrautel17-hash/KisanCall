/**
 * KisanCall — Auth Context
 * Manages JWT token and current user state globally
 */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('kc_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const [token, setToken] = useState(() => localStorage.getItem('kc_token') || null);

    const login = (userData, accessToken) => {
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('kc_user', JSON.stringify(userData));
        localStorage.setItem('kc_token', accessToken);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('kc_user');
        localStorage.removeItem('kc_token');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoggedIn: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};
