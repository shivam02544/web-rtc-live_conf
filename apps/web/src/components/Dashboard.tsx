'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CallInterface from './CallInterface';
import { OnlineUsers } from './OnlineUsers';
import { ThemeToggle } from './ThemeToggle';

interface User {
  id: string;
  name: string;
  email: string;
}

export function Dashboard({ user, token }: { user: User; token: string }) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  async function handleLogout() {
    await fetch('/api/auth/me', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                VideoCall
              </span>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* User Info */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white pr-1">
                  {user.name}
                </span>
              </div>

              <ThemeToggle />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-200/50 dark:hover:border-slate-700/50 transition-all"
                aria-label="Logout"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-16 min-h-[calc(100dvh-4rem)]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 min-h-[calc(100dvh-4rem)] py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 lg:gap-6 min-h-full lg:h-[calc(100dvh-7rem)]">
            {/* Sidebar - Online Users */}
            <aside className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 overflow-hidden flex flex-col min-h-56 lg:min-h-0">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Online Users
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Select to start a call
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto -mx-2 px-2 scrollbar-thin">
                <OnlineUsers
                  currentUserId={user.id}
                  onSelectUser={(id, name) => setSelectedUser({ id, name })}
                  selectedUserId={selectedUser?.id ?? null}
                />
              </div>
            </aside>

            {/* Main Video Area */}
            <main className="flex flex-col gap-4 sm:gap-5 min-h-[26rem] lg:min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    {selectedUser ? `Call with ${selectedUser.name}` : 'Video Room'}
                  </h1>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xs">
                        End-to-end encrypted
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Container */}
              <div className="flex-1 min-h-[24rem] lg:min-h-0 bg-slate-950 rounded-xl overflow-hidden relative border border-slate-800">
                <CallInterface token={token} targetUserId={selectedUser?.id} />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
