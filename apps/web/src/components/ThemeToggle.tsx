'use client';

import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        onClick={() => setTheme('light')}
        className={`theme-toggle-button ${
          theme === 'light'
            ? 'theme-toggle-active'
            : ''
        }`}
        title="Light mode"
        aria-label="Light mode"
        aria-pressed={theme === 'light'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </button>

      <button
        onClick={() => setTheme('system')}
        className={`theme-toggle-button ${
          theme === 'system'
            ? 'theme-toggle-active'
            : ''
        }`}
        title="System mode"
        aria-label="System theme"
        aria-pressed={theme === 'system'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`theme-toggle-button ${
          theme === 'dark'
            ? 'theme-toggle-active'
            : ''
        }`}
        title="Dark mode"
        aria-label="Dark mode"
        aria-pressed={theme === 'dark'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </button>
    </div>
  );
}
