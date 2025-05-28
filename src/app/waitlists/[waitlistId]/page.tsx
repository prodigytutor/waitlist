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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { StatusDefinition } from '@/lib/redis'; // Assuming this type is exported or re-define here
import LeadDetailModal from '@/components/leads/LeadDetailModal'; // Import the modal

// Define a more detailed Lead interface based on what redis.ts provides
interface Lead {
  id: string; // leadId
  email: string;
  createdAt: string; // Renaming to joinedAt for display consistency if needed, but API returns createdAt
  originalWaitlistId: string;
  currentStatusId: string;
  currentScore: number;
  customFields?: Record<string, string>; // Optional custom fields
}

interface WaitlistDetails {
  id: string;
  name: string;
  createdAt: string;
  userId: string;
}

// Re-define StatusDefinition if not directly importable or for client-side adjustments
// export interface StatusDefinition {
//   id: string;
//   name: string;
//   color?: string;
//   order: number;
// }

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
  const [statusDefinitions, setStatusDefinitions] = useState<StatusDefinition[]>([]);
  
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  
  // Specific loading/error states for actions if needed, or use a general one
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null); // leadId of status being updated
  const [isRecalculatingScore, setIsRecalculatingScore] = useState<string | null>(null); // leadId of score being recalculated
  const [isRecalculatingAllScores, setIsRecalculatingAllScores] = useState(false);

  // State for the modal
  const [selectedLeadIdForModal, setSelectedLeadIdForModal] = useState<string | null>(null);


  const fetchData = async (showLoadingToast = false) => {
    if (showLoadingToast) {
        toast.info("Refreshing lead data...");
    }
    if (sessionStatus === 'authenticated' && waitlistId && session?.user) {
      setIsLoadingPageData(true);
      setPageError(null);
      try {
        const [detailsRes, leadsRes, statusesRes] = await Promise.all([
          fetch(`/api/waitlists/${waitlistId}`),
          fetch(`/api/waitlists/${waitlistId}/leads`),
          fetch(`/api/waitlists/${waitlistId}/statuses`),
        ]);

        if (!detailsRes.ok) {
          const errorData = await detailsRes.json();
          throw new Error(errorData.error || `Error fetching details: ${detailsRes.status}`);
        }
        const detailsData: WaitlistDetails = await detailsRes.json();
        if (detailsData.userId !== (session.user as any).id) {
          throw new Error("Forbidden: You don't have access to this waitlist.");
        }
        setWaitlistDetails(detailsData);

        if (!leadsRes.ok) {
          const errorData = await leadsRes.json();
          throw new Error(errorData.error || `Error fetching leads: ${leadsRes.status}`);
        }
        const leadsData: Lead[] = await leadsRes.json();
        setLeads(leadsData);

        if (!statusesRes.ok) {
          const errorData = await statusesRes.json();
          throw new Error(errorData.error || `Error fetching statuses: ${statusesRes.status}`);
        }
        const statusesData: StatusDefinition[] = await statusesRes.json();
        setStatusDefinitions(statusesData.sort((a,b) => a.order - b.order));

      } catch (error: any) {
        console.error("Error fetching waitlist page data:", error);
        setPageError(error.message);
      } finally {
        setIsLoadingPageData(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [sessionStatus, waitlistId, session?.user]);


  const handleRemoveLead = async (leadId: string, email: string) // Changed to leadId
   => {
    if (!waitlistDetails) return;
    if (!window.confirm(`Are you sure you want to remove ${email} from this waitlist?`)) {
      return;
    }

    try {
      // Need to pass email for the API, but leadId for UI update
      const response = await fetch(`/api/waitlists/${waitlistId}/leads`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }), // API expects email
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove lead');
      }
      toast.success(`Lead ${email} removed successfully!`);
      setLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId));
    } catch (error: any) {
      toast.error(`Error removing lead: ${error.message}`);
      console.error("Error removing lead:", error);
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatusId: string) => {
    setIsUpdatingStatus(leadId);
    try {
        const response = await fetch(`/api/leads/${leadId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statusId: newStatusId }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update status');
        }
        toast.success(`Status updated for lead ${leadId}`);
        // Optimistically update UI or refetch lead data / entire list
        setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? {...l, currentStatusId: newStatusId} : l));
    } catch (error: any) {
        toast.error(`Error updating status: ${error.message}`);
        console.error("Error updating status:", error);
    } finally {
        setIsUpdatingStatus(null);
    }
  };

  const handleRecalculateScore = async (leadId: string) => {
    setIsRecalculatingScore(leadId);
    try {
        const response = await fetch(`/api/leads/${leadId}/calculate-score`, { method: 'POST' });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to recalculate score');
        }
        const { newScore } = await response.json();
        toast.success(`Score recalculated for lead ${leadId}. New score: ${newScore}`);
        setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? {...l, currentScore: newScore} : l));
    } catch (error: any) {
        toast.error(`Error recalculating score: ${error.message}`);
        console.error("Error recalculating score:", error);
    } finally {
        setIsRecalculatingScore(null);
    }
  };
  
  const handleRecalculateAllScores = async () => {
    setIsRecalculatingAllScores(true);
    toast.info("Recalculating scores for all leads...");
    let successCount = 0;
    let errorCount = 0;

    for (const lead of leads) {
        try {
            const response = await fetch(`/api/leads/${lead.id}/calculate-score`, { method: 'POST' });
            if (!response.ok) {
                errorCount++;
                console.warn(`Failed to update score for ${lead.id}`);
                continue;
            }
            const { newScore } = await response.json();
            // Update local state for this lead
            setLeads(prev => prev.map(l => l.id === lead.id ? {...l, currentScore: newScore} : l));
            successCount++;
        } catch (e) {
            errorCount++;
            console.warn(`Error updating score for ${lead.id}`, e);
        }
    }
    toast.success(`${successCount} scores recalculated. ${errorCount > 0 ? `${errorCount} errors.` : ''}`);
    setIsRecalculatingAllScores(false);
  };
  
  const handleViewEditDetails = (leadId: string) => {
    setSelectedLeadIdForModal(leadId);
  };

  const handleCloseModal = (refreshNeeded?: boolean) => {
    setSelectedLeadIdForModal(null);
    if (refreshNeeded) {
      fetchData(true); // Pass true to indicate it's a refresh, potentially show a toast
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


  if (sessionStatus === 'loading' || isLoadingPageData) {
    return <p>Loading waitlist details...</p>;
  }

  if (pageError) {
    return <p style={{ color: 'red' }}>Error: {pageError}</p>;
  }

  if (!waitlistDetails) {
    return <p>Waitlist not found or access denied.</p>;
  }

  return (
    <> {/* Use Fragment to allow multiple root elements including the modal */}
      <div> {/* Existing page content wrapper */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1>{waitlistDetails.name}</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" onClick={() => router.push(`/waitlists/${waitlistId}/settings`)}>
            Settings
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
      <p>Created: {new Date(waitlistDetails.createdAt).toLocaleDateString()}</p>
      <p>Waitlist ID: <code>{waitlistDetails.id}</code></p>
      <Button variant="secondary" size="sm" onClick={copyPublicUrlToClipboard} style={{marginTop: '0.5rem', marginBottom: '1rem'}}>
        Copy Public Signup URL
      </Button>

      <section style={{ marginTop: '2rem' }}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Leads <Badge variant="secondary">{leads.length}</Badge></h2>
            <Button onClick={handleRecalculateAllScores} disabled={isRecalculatingAllScores} size="sm">
                {isRecalculatingAllScores ? "Recalculating..." : "Recalculate All Scores"}
            </Button>
        </div>

        {/* Removed isLoadingLeads and leadsError as they are covered by isLoadingPageData and pageError */}
        {!isLoadingPageData && !pageError && leads.length === 0 && (
          <p>No leads have joined this waitlist yet.</p>
        )}
        {leads.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Joined At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const status = statusDefinitions.find(s => s.id === lead.currentStatusId);
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.email}</TableCell>
                    <TableCell>{new Date(lead.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        style={status?.color ? { backgroundColor: status.color, color: '#fff', borderColor: status.color } : {}}
                      >
                        {status?.name || lead.currentStatusId}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.currentScore}</TableCell>
                    <TableCell className="text-right space-x-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={isUpdatingStatus === lead.id}>
                                    {isUpdatingStatus === lead.id ? "Saving..." : "Set Status"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {statusDefinitions.map(sDef => (
                                    <DropdownMenuItem 
                                        key={sDef.id} 
                                        onClick={() => handleUpdateLeadStatus(lead.id, sDef.id)}
                                        disabled={lead.currentStatusId === sDef.id}
                                    >
                                        {sDef.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="sm" onClick={() => handleRecalculateScore(lead.id)} disabled={isRecalculatingScore === lead.id}>
                            {isRecalculatingScore === lead.id ? "..." : "Re-Score"}
                        </Button>
                         <Button variant="ghost" size="sm" onClick={() => handleViewEditDetails(lead.id)}>
                            Details
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveLead(lead.id, lead.email)}
                        >
                            Remove
                        </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>

    {/* Modal Integration */}
    {selectedLeadIdForModal && (
        <LeadDetailModal
            isOpen={!!selectedLeadIdForModal}
            onClose={() => handleCloseModal(true)} // Pass true to refresh data on close
            leadId={selectedLeadIdForModal}
            // waitlistId={waitlistId} // waitlistId is derived from lead's originalWaitlistId within modal
        />
    )}
    </>
  );
}
