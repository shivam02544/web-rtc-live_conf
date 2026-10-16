'use client';

import { useEffect, useState } from 'react';

interface OnlineUser {
  id: string;
  name: string;
  status: string;
}

interface OnlineUsersProps {
  currentUserId: string;
  onSelectUser: (userId: string, name: string) => void;
  selectedUserId: string | null;
}

export function OnlineUsers({ currentUserId, onSelectUser, selectedUserId }: OnlineUsersProps) {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchUsers() {
      try {
        const response = await fetch('/api/users/online');
        if (!response.ok) throw new Error('Unable to load online people');
        const data = await response.json();
        if (active) setUsers(data.users.filter((person: OnlineUser) => person.id !== currentUserId));
      } catch (error) {
        console.error('Failed to fetch online users:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentUserId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
          No one online
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Users will appear here when they come online
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((person) => {
        const isSelected = selectedUserId === person.id;
        return (
          <button
            key={person.id}
            onClick={() => onSelectUser(person.id, person.name)}
            className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl transition-all group ${
              isSelected
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800'
                : 'bg-transparent border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all ${
                isSelected
                ? 'bg-indigo-600'
                : 'bg-slate-500'
              }`}>
                {person.name.charAt(0).toUpperCase()}
              </div>
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm" />
            </div>

            {/* User Info */}
            <div className="flex-1 text-left min-w-0">
              <p className={`text-sm font-bold truncate transition-colors ${
                isSelected
                ? 'text-indigo-900 dark:text-indigo-100'
                  : 'text-slate-900 dark:text-white'
              }`}>
                {person.name}
              </p>
              <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${
                isSelected
                ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Available
              </p>
            </div>

            {/* Call Icon */}
            <div className={`flex-shrink-0 transition-all ${
              isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
            }`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isSelected
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
