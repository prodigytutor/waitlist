"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WaitlistForm } from '@/components/waitlist-form'; // Ensure this path is correct

interface WaitlistDetails {
  id: string;
  name: string;
  // We don't necessarily need createdAt or userId for the public page
}

export default function PublicWaitlistPage() {
  const params = useParams();
  const router = useRouter();
  const waitlistId = params.waitlistId as string;

  const [waitlistName, setWaitlistName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    if (waitlistId) {
      setIsLoading(true);
      setError(null);
      // Fetch waitlist details (name) to display on the page
      // This API endpoint (GET /api/waitlists/{waitlistId}) requires authentication.
      // For a public page, we might need a different, unauthenticated endpoint
      // to fetch basic, non-sensitive waitlist details like the name.
      // For now, let's assume the existing endpoint or a new public one.
      // If GET /api/waitlists/{waitlistId} is strictly protected, this fetch will fail
      // unless the user happens to be logged in AND owns the waitlist, which is not the public use case.
      //
      // **Assumption for this task**: We'll simulate fetching the waitlist name.
      // In a real scenario, you'd need a public API route: GET /api/public/waitlists/{waitlistId}/name
      // For now, we'll try to use the existing GET /api/waitlists/{waitlistId} and if it fails,
      // we will just proceed without displaying the name, or show a generic title.
      // A better approach is to have a dedicated public endpoint.
      
      // Let's try fetching details - this will likely fail if the user is not logged in as the owner
      fetch(`/api/waitlists/${waitlistId}`)
        .then(async (res) => {
          if (!res.ok) {
            // If it fails (e.g. 401, 403, 404), we won't be able to get the name.
            // We can set a generic name or handle this gracefully.
            console.warn(`Could not fetch waitlist name (status: ${res.status}). Proceeding without it.`);
            // Not setting an error here as the form itself should still work.
            return null;
          }
          return res.json();
        })
        .then((data: WaitlistDetails | null) => {
          if (data) {
            setWaitlistName(data.name);
          }
        })
        .catch((e) => {
          console.warn("Error fetching waitlist name, proceeding without it:", e);
          // Not critical for the form to function, so don't set a page-breaking error.
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setError("No Waitlist ID provided.");
      setIsLoading(false);
    }
  }, [waitlistId]);

  const handleSuccess = () => {
    setSignupSuccess(true);
  };

  if (isLoading && !waitlistName) { // Only show loading if name is not yet available
    return <p className="text-center mt-10">Loading waitlist...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">Error: {error}</p>;
  }

  if (!waitlistId) { // Should be caught by error state, but as a fallback
    return <p className="text-center mt-10 text-red-500">Waitlist not found.</p>;
  }
  
  if (signupSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <h1 className="text-3xl font-semibold mb-4">Thank You!</h1>
        <p className="text-lg mb-2">
          You've successfully joined {waitlistName ? `the waitlist for "${waitlistName}"` : "the waitlist"}.
        </p>
        <p>We'll keep you updated!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      {waitlistName && (
        <h1 className="text-3xl font-semibold mb-4">
          Join the Waitlist for {waitlistName}
        </h1>
      )}
      {!waitlistName && !isLoading && ( // Show generic if name couldn't be fetched and not loading
         <h1 className="text-3xl font-semibold mb-4">
          Join Our Waitlist
        </h1>
      )}
      <p className="mb-8 text-lg max-w-md">
        Be the first to know when we launch. Enter your email below to get early access.
      </p>
      <WaitlistForm waitlistId={waitlistId} onSuccess={handleSuccess} />
    </div>
  );
}
