"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Assuming Button component is available

export default function AuthHeader() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div style={{ padding: '1rem', textAlign: 'right' }}>Loading session...</div>;
  }

  return (
    <header style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
      <div>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>
          Zeitlist
        </Link>
        {session && (
          <Link href="/dashboard" style={{ marginLeft: '1rem', textDecoration: 'none', color: 'blue' }}>
            Dashboard
          </Link>
        )}
      </div>
      <div>
        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Signed in as {session.user?.email}</span>
            <Button onClick={() => signOut({ callbackUrl: '/' })} variant="outline">
              Sign Out
            </Button>
          </div>
        ) : (
          <Button onClick={() => signIn()} variant="default"> 
            {/* signIn() without args will redirect to the page defined in authOptions.pages.signIn */}
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
}
