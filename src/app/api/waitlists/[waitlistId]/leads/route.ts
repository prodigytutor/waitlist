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

    const success = await addToWaitlist(waitlistId, email);

    if (success) {
      return NextResponse.json({ message: 'Successfully added to waitlist' }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Email already registered or failed to add' }, { status: 409 });
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
