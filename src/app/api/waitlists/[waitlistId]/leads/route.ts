import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { addToWaitlist, getWaitlistDetails, removeLeadFromWaitlist, getLeadsForWaitlist } from '@/lib/redis'; // Added getLeadsForWaitlist
import { getCurrentUserId } from '@/lib/authUtils';
// import arcjet from '@arcjet/next'; // Placeholder for Arcjet import

// Placeholder for Arcjet instance if needed for specific protection
// const aj = arcjet({
//   key: process.env.ARCJET_KEY!, // Your Arcjet site key
//   rules: [
//     // Add specific Arcjet rules if needed for this endpoint
//   ],
// });

const emailSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

interface LeadParams {
  params: {
    waitlistId: string;
  };
}

export async function POST(request: NextRequest, { params }: LeadParams) {
  try {
    // Placeholder for Arcjet protection - typically at the beginning
    // const { success, reason, ...decision } = await aj.protect(request);
    // if (!success) {
    //   return NextResponse.json({ error: reason || 'Protection error' }, { status: decision.status || 403 });
    // }

    const { waitlistId } = params;
    if (!waitlistId) {
      return NextResponse.json({ error: 'Waitlist ID is required' }, { status: 400 });
    }

    // Validate request body
    const body = await request.json();
    const parsed = emailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
    }

    const { email } = parsed.data;

    // Check if waitlist exists (optional, but good practice)
    const waitlist = await getWaitlistDetails(waitlistId);
    if (!waitlist) {
      return NextResponse.json({ error: 'Waitlist not found' }, { status: 404 });
    }
    // Note: This endpoint is public for adding leads, so no ownership check here.

    const leadId = await addToWaitlist(waitlistId, email);

    if (leadId) {
      // addToWaitlist now returns leadId for both new and existing leads (if email was already on the waitlist)
      // Or null on actual failure to add.
      // The client might want to know if it was a new or existing lead,
      // but for now, returning the leadId is sufficient.
      // A 201 (Created) could be used for new leads, and 200 (OK) for existing.
      // For simplicity, we'll use 200 and let the client decide if it needs more info (e.g., by fetching lead details).
      return NextResponse.json({ leadId: leadId, message: 'Lead processed successfully.' }, { status: 200 });
    } else {
      // This implies an internal error in addToWaitlist, not a duplicate.
      return NextResponse.json({ error: 'Failed to add lead to waitlist' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in POST /api/waitlists/[waitlistId]/leads:`, error);
    if (error instanceof SyntaxError) { // From await request.json()
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: LeadParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { waitlistId } = params;
    if (!waitlistId) {
      return NextResponse.json({ error: 'Waitlist ID is required' }, { status: 400 });
    }

    // Authorization: Check if the waitlist belongs to the current user
    const waitlist = await getWaitlistDetails(waitlistId);
    if (!waitlist) {
      return NextResponse.json({ error: 'Waitlist not found' }, { status: 404 });
    }
    if (waitlist.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leads = await getLeadsForWaitlist(waitlistId);
    return NextResponse.json(leads, { status: 200 });

  } catch (error) {
    console.error(`Error in GET /api/waitlists/[waitlistId]/leads:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: LeadParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { waitlistId } = params;
    if (!waitlistId) {
      return NextResponse.json({ error: 'Waitlist ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = emailSchema.safeParse(body); // Validate email format

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
    }
    const { email } = parsed.data;

    // Authorization: Check if the waitlist belongs to the current user
    const waitlist = await getWaitlistDetails(waitlistId);
    if (!waitlist) {
      return NextResponse.json({ error: 'Waitlist not found' }, { status: 404 });
    }
    if (waitlist.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const success = await removeLeadFromWaitlist(waitlistId, email);

    if (success) {
      return NextResponse.json({ message: 'Lead removed successfully' }, { status: 200 });
    } else {
      // This could mean the email was not found on this specific waitlist
      return NextResponse.json({ error: 'Lead not found on waitlist or failed to remove' }, { status: 404 });
    }
  } catch (error) {
    console.error(`Error in DELETE /api/waitlists/[waitlistId]/leads:`, error);
     if (error instanceof SyntaxError) { // From await request.json()
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
