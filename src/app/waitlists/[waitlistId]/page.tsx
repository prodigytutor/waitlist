"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // For potential future use (e.g. adding leads)
import { Label } from '@/components/ui/label'; // For potential future use
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // For displaying leads
import { Badge } from "@/components/ui/badge"; // For displaying status or count

interface WaitlistDetails {
  id: string;
  name: string;
  createdAt: string;
  userId: string;
}

interface Lead {
  email: string;
  joinedAt: string;
}

export default function WaitlistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const waitlistId = params.waitlistId as string; // Assuming waitlistId will always be a string

  const { data: session, status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() {
      router.push('/auth/signin');
    },
  });

  const [waitlistDetails, setWaitlistDetails] = useState<WaitlistDetails | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && waitlistId) {
      setIsLoadingDetails(true);
      setDetailError(null);
      fetch(`/api/waitlists/${waitlistId}`)
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Error: ${res.status}`);
          }
          return res.json();
        })
        .then((data: WaitlistDetails) => {
          // Authorization check already happened on the server, but good for client defense
          if (data.userId !== (session?.user as any)?.id) {
            setDetailError("Forbidden: You don't have access to this waitlist.");
            setWaitlistDetails(null); // Clear any potentially loaded data
            return;
          }
          setWaitlistDetails(data);
          // If details fetched successfully, fetch leads
          setIsLoadingLeads(true);
          setLeadsError(null);
          return fetch(`/api/waitlists/${waitlistId}/leads`);
        })
        .then(async (res) => {
          if (!res) return; // In case of forbidden access to details
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Error fetching leads: ${res.status}`);
          }
          return res.json();
        })
        .then((leadsData: Lead[] | undefined) => {
          if (leadsData) {
            setLeads(leadsData);
          }
        })
        .catch((error: any) => {
          console.error("Error fetching waitlist data:", error);
          // Differentiate between detail and leads error if possible,
          // for now, a general error if details were the target
          if (!waitlistDetails) { // If details haven't been set, error is likely from fetching details
            setDetailError(error.message);
          } else { // Otherwise, error is from fetching leads
            setLeadsError(error.message);
          }
        })
        .finally(() => {
          setIsLoadingDetails(false);
          setIsLoadingLeads(false);
        });
    }
  }, [sessionStatus, waitlistId, session?.user]);

  const handleRemoveLead = async (email: string) => {
    if (!waitlistDetails) return;
    if (!window.confirm(`Are you sure you want to remove ${email} from this waitlist?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/waitlists/${waitlistId}/leads`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove lead');
      }
      alert('Lead removed successfully!'); // Or use a toast
      // Refresh leads
      setLeads(prevLeads => prevLeads.filter(lead => lead.email !== email));
    } catch (error: any) {
      alert(`Error removing lead: ${error.message}`); // Or use a toast
      console.error("Error removing lead:", error);
    }
  };
  
  const copyPublicUrlToClipboard = () => {
    const url = `${window.location.origin}/waitlist-public/${waitlistId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Public URL copied to clipboard!');
    }).catch(err => {
      alert('Failed to copy URL.');
      console.error('Failed to copy URL: ', err);
    });
  };


  if (sessionStatus === 'loading' || isLoadingDetails) {
    return <p>Loading waitlist details...</p>;
  }

  if (detailError) {
    return <p style={{ color: 'red' }}>Error: {detailError}</p>;
  }

  if (!waitlistDetails) {
    return <p>Waitlist not found or access denied.</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>{waitlistDetails.name}</h1>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
      <p>Created: {new Date(waitlistDetails.createdAt).toLocaleDateString()}</p>
      <p>Waitlist ID: <code>{waitlistDetails.id}</code></p>
      <Button variant="secondary" size="sm" onClick={copyPublicUrlToClipboard} style={{marginTop: '0.5rem', marginBottom: '1rem'}}>
        Copy Public Signup URL
      </Button>

      <section style={{ marginTop: '2rem' }}>
        <h2>Leads <Badge variant="secondary">{leads.length}</Badge></h2>
        {isLoadingLeads && <p>Loading leads...</p>}
        {leadsError && <p style={{ color: 'red' }}>Error fetching leads: {leadsError}</p>}
        {!isLoadingLeads && !leadsError && leads.length === 0 && (
          <p>No leads have joined this waitlist yet.</p>
        )}
        {leads.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Joined At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.email}>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{new Date(lead.joinedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveLead(lead.email)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
