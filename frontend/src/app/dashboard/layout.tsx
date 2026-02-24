'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex gap-6 md:gap-10">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="inline-block font-bold">Outpost</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <UserButton>
                <UserButton.MenuItems>
                  <UserButton.Action
                    label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    labelIcon={
                      theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
                    }
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  />
                </UserButton.MenuItems>
              </UserButton>
            </nav>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
