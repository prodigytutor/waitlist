"use client"; // This directive is required for components using client-side hooks like useSession

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function AuthExample() {
  const { data: session, status } = useSession();
  const [protectedData, setProtectedData] = useState(null);
  const [loadingProtected, setLoadingProtected] = useState(false);

  const fetchProtectedData = async () => {
    setLoadingProtected(true);
    const res = await fetch("/api/protected");
    const data = await res.json();
    setProtectedData(data);
    setLoadingProtected(false);
  };

  if (status === "loading") {
    return <p>Loading session...</p>;
  }

  return (
    <div>
      <h1>NextAuth.js Example</h1>
      {!session && (
        <>
          <p>You are not signed in.</p>
          <button onClick={() => signIn()}>Sign In</button>
          <p>Use email: jsmith@example.com and password: password</p>
        </>
      )}
      {session && (
        <>
          <p>Signed in as {session.user?.email}</p>
          <p>User ID from session: {(session.user as any)?.id}</p>
          <button onClick={() => signOut()}>Sign Out</button>
          <div>
            <button onClick={fetchProtectedData} disabled={loadingProtected}>
              {loadingProtected ? "Loading..." : "Fetch Protected Data"}
            </button>
            {protectedData && (
              <pre>{JSON.stringify(protectedData, null, 2)}</pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Example of using getServerSession for server-side protection
// This would typically be in a Next.js API route or a server component

/*
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed

export async function someServerSideHandler(req, res) { // Or Page Route, or Server Component
  const session = await getServerSession(req, res, authOptions); // For API routes, pass req and res

  // For App Router Route Handlers (like the /api/protected/route.ts we created):
  // const session = await getServerSession(authOptions);

  if (session) {
    // User is authenticated, proceed with server-side logic
    // e.g., fetch data from a database using session.user.id
    return { props: { data: `Protected data for ${session.user.name}` } };
  } else {
    // User is not authenticated
    // Redirect to sign-in page or return an error
    return { redirect: { destination: '/auth/signin', permanent: false } };
    // Or for API routes: res.status(401).json({ error: "Unauthorized" });
  }
}
*/
