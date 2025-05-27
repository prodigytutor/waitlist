"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation'; // Corrected import for App Router
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Waitlist {
  id: string;
  name: string;
  createdAt: string;
  userId?: string; // userId might not always be needed on the client for display
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push('/auth/signin');
    },
  });

  const [waitlists, setWaitlists] = useState<Waitlist[]>([]);
  const [isLoadingWaitlists, setIsLoadingWaitlists] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [newWaitlistName, setNewWaitlistName] = useState('');
  const [isCreatingWaitlist, setIsCreatingWaitlist] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const fetchWaitlists = async () => {
    setIsLoadingWaitlists(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/users/me/waitlists');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch waitlists: ${response.status}`);
      }
      const data: Waitlist[] = await response.json();
      setWaitlists(data);
    } catch (error: any) {
      setFetchError(error.message);
      console.error("Error fetching waitlists:", error);
    } finally {
      setIsLoadingWaitlists(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchWaitlists();
    }
  }, [status]);

  const handleCreateWaitlist = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreatingWaitlist(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const response = await fetch('/api/users/me/waitlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlistName: newWaitlistName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to create waitlist: ${response.status}`);
      }
      setCreateSuccess(`Waitlist "${data.name}" created successfully!`);
      setNewWaitlistName(''); // Reset form
      fetchWaitlists(); // Refresh the list
    } catch (error: any) {
      setCreateError(error.message);
      console.error("Error creating waitlist:", error);
    } finally {
      setIsCreatingWaitlist(false);
    }
  };

  const handleDeleteWaitlist = async (waitlistId: string, waitlistName: string) => {
    if (!window.confirm(`Are you sure you want to delete the waitlist "${waitlistName}"?`)) {
      return;
    }
    // Optimistically remove from UI or set a specific loading state for the item
    // For simplicity, we'll refetch the whole list after deletion.
    try {
      const response = await fetch(`/api/waitlists/${waitlistId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to delete waitlist: ${response.status}`);
      }
      alert(`Waitlist "${waitlistName}" deleted successfully!`); // Or use a toast
      fetchWaitlists(); // Refresh the list
    } catch (error: any) {
      alert(`Error deleting waitlist: ${error.message}`); // Or use a toast
      console.error("Error deleting waitlist:", error);
    }
  };

  if (status === 'loading') {
    return <p>Loading dashboard...</p>;
  }

  if (!session) {
    // This should be handled by onUnauthenticated, but as a fallback:
    return <p>Redirecting to sign in...</p>; 
  }

  return (
    <div>
      <h1>My Dashboard</h1>
      <p>Welcome, {session.user?.email}!</p>

      <section style={{ marginTop: '2rem', marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Create New Waitlist</h2>
        <form onSubmit={handleCreateWaitlist}>
          <div style={{ marginBottom: '0.5rem' }}>
            <Label htmlFor="waitlistName">Waitlist Name</Label>
            <Input
              id="waitlistName"
              type="text"
              value={newWaitlistName}
              onChange={(e) => setNewWaitlistName(e.target.value)}
              required
              disabled={isCreatingWaitlist}
              style={{marginRight: '0.5rem'}}
            />
          </div>
          <Button type="submit" disabled={isCreatingWaitlist}>
            {isCreatingWaitlist ? 'Creating...' : 'Create Waitlist'}
          </Button>
          {createError && <p style={{ color: 'red', marginTop: '0.5rem' }}>Error: {createError}</p>}
          {createSuccess && <p style={{ color: 'green', marginTop: '0.5rem' }}>{createSuccess}</p>}
        </form>
      </section>

      <section>
        <h2>My Waitlists</h2>
        {isLoadingWaitlists && <p>Loading waitlists...</p>}
        {fetchError && <p style={{ color: 'red' }}>Error fetching waitlists: {fetchError}</p>}
        {!isLoadingWaitlists && !fetchError && waitlists.length === 0 && (
          <p>You haven't created any waitlists yet.</p>
        )}
        {waitlists.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {waitlists.map((wl) => (
              <li key={wl.id} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{wl.name}</h3>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}>
                    Created: {new Date(wl.createdAt).toLocaleDateString()}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#777' }}>
                    ID: {wl.id}
                  </p>
                </div>
                <div>
                  <Button variant="outline" size="sm" style={{ marginRight: '0.5rem' }} onClick={() => router.push(`/waitlists/${wl.id}`)}>
                    View
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteWaitlist(wl.id, wl.name)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
