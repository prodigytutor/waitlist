"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWaitlistDetails } from '@/lib/redis'; // This is a server-side function, cannot be used directly here. API call needed.

// Placeholder types (will be refined in actual tab components)
interface Waitlist {
  id: string;
  name: string;
  userId: string;
}

import StatusesManager from '@/components/waitlist-settings/StatusesManager'; 
import CustomFieldsManager from '@/components/waitlist-settings/CustomFieldsManager'; 
import ScoringRulesManager from '@/components/waitlist-settings/ScoringRulesManager'; // Import the new component


export default function WaitlistSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const waitlistId = params.waitlistId as string;

  const { data: session, status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() {
      router.push('/auth/signin');
    },
  });

  const [waitlistName, setWaitlistName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && waitlistId && session?.user) {
      setIsLoading(true);
      fetch(`/api/waitlists/${waitlistId}`) // API endpoint to get waitlist details
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Error: ${res.status}`);
          }
          return res.json();
        })
        .then((data: Waitlist) => {
          if (data.userId !== (session.user as any).id) {
            setError("Forbidden: You do not own this waitlist.");
            return;
          }
          setWaitlistName(data.name);
        })
        .catch((err: any) => {
          console.error("Error fetching waitlist details:", err);
          setError(err.message || "Failed to load waitlist details.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [sessionStatus, waitlistId, session, router]);

  if (isLoading || sessionStatus === 'loading') {
    return <p>Loading settings...</p>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-red-500">Error: {error}</p>
        <Button onClick={() => router.push(`/waitlists/${waitlistId}`)} variant="outline" className="mt-4">
          Back to Waitlist
        </Button>
      </div>
    );
  }

  if (!waitlistName) { // If error is not set but name isn't there (e.g. forbidden set error)
    return (
         <div className="container mx-auto p-4">
            <p className="text-red-500">Could not load waitlist settings.</p>
             <Button onClick={() => router.push(`/waitlists/${waitlistId}`)} variant="outline" className="mt-4">
                Back to Waitlist
            </Button>
         </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Settings for {waitlistName}</h1>
        <Button onClick={() => router.push(`/waitlists/${waitlistId}`)} variant="outline">
          Back to Waitlist
        </Button>
      </div>

      <Tabs defaultValue="statuses" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="customfields">Custom Fields</TabsTrigger>
          <TabsTrigger value="scoringrules">Scoring Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="statuses" className="mt-4">
          <StatusesManager waitlistId={waitlistId} />
        </TabsContent>
        <TabsContent value="customfields" className="mt-4">
          <CustomFieldsManager waitlistId={waitlistId} />
        </TabsContent>
        <TabsContent value="scoringrules" className="mt-4">
          <ScoringRulesManager waitlistId={waitlistId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
