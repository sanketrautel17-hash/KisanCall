/**
 * KisanCall — Language Context
 *
 * Manages the preferred consultation language (Hindi or English).
 * - Persisted to localStorage
 * - Used by farmer when requesting a call (hint for AI summary language)
 * - Provides a LanguageToggle component
 */
import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(
        () => localStorage.getItem('kc_lang') || 'en'
    );

    const toggleLanguage = () => {
        const newLang = language === 'en' ? 'hi' : 'en';
        setLanguage(newLang);
        localStorage.setItem('kc_lang', newLang);
    };

    const setLang = (lang) => {
        setLanguage(lang);
        localStorage.setItem('kc_lang', lang);
    };

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, setLang, isHindi: language === 'hi' }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
    return ctx;
};

/**
 * Standalone LanguageToggle component — can be dropped anywhere.
 */
export function LanguageToggle({ compact = false }) {
    const { language, toggleLanguage } = useLanguage();
    const isHindi = language === 'hi';

    return (
        <button
            id="language-toggle-btn"
            onClick={toggleLanguage}
            title={isHindi ? 'Switch to English' : 'हिंदी में बदलें'}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: isHindi
                    ? 'rgba(245,158,11,0.12)'
                    : 'rgba(34,197,94,0.1)',
                border: `1px solid ${isHindi ? 'rgba(245,158,11,0.35)' : 'rgba(34,197,94,0.25)'}`,
                borderRadius: '999px',
                padding: compact ? '0.3rem 0.7rem' : '0.4rem 0.9rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: compact ? '0.78rem' : '0.85rem',
                fontWeight: 600,
                color: isHindi ? '#fbbf24' : 'var(--green-400)',
                transition: 'all 0.22s ease',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
            }}
        >
            {isHindi ? '🇮🇳 हिंदी' : '🇬🇧 English'}
        </button>
    );
}
