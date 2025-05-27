import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary

// We don't need NextRequest here as getServerSession for App Router doesn't always need it.
// The authOptions already configure how to get the session.

interface UserSession {
  user?: {
    id?: string;
    // include other user properties if your session callback adds them
  };
}

export async function getCurrentUserId(): Promise<string | null> {
  // For App Router Route Handlers or Server Components,
  // you usually call getServerSession(authOptions).
  const session: UserSession | null = await getServerSession(authOptions);

  if (session && session.user && typeof session.user.id === 'string') {
    return session.user.id;
  }
  return null;
}
