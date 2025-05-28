import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/authUtils';
import { getLeadDetails, getWaitlistDetails } from '@/lib/redis';

interface LeadDetailParams {
  params: {
    leadId: string;
  };
}

export async function GET(request: NextRequest, { params }: LeadDetailParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = params;
    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const leadDetails = await getLeadDetails(leadId); // This already includes customFields
    if (!leadDetails || !leadDetails.originalWaitlistId) {
      return NextResponse.json({ error: 'Lead not found or missing original waitlist ID' }, { status: 404 });
    }

    // Authorize: Check if the current user owns the waitlist this lead belongs to
    const waitlistDetails = await getWaitlistDetails(leadDetails.originalWaitlistId);
    if (!waitlistDetails || waitlistDetails.userId !== userId) {
      // If waitlistDetails are null, it means the waitlist doesn't exist (should be rare if lead exists)
      // If userId doesn't match, it's a forbidden access.
      return NextResponse.json({ error: 'Forbidden or waitlist not found' }, { status: waitlistDetails ? 403 : 404 });
    }

    return NextResponse.json(leadDetails, { status: 200 });

  } catch (error) {
    console.error(`Error in GET /api/leads/[leadId]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
