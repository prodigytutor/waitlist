import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/authUtils';
import { 
  getLeadDetails, 
  getWaitlistDetails, 
  calculateAndStoreLeadScore 
} from '@/lib/redis';

interface CalculateScoreParams {
  params: {
    leadId: string;
  };
}

export async function POST(request: NextRequest, { params }: CalculateScoreParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = params;
    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    // Authorization: Check if the user owns the waitlist associated with the lead
    const leadDetails = await getLeadDetails(leadId);
    if (!leadDetails || !leadDetails.originalWaitlistId) {
      return NextResponse.json({ error: 'Lead not found or missing original waitlist ID' }, { status: 404 });
    }

    const waitlistDetails = await getWaitlistDetails(leadDetails.originalWaitlistId);
    if (!waitlistDetails || waitlistDetails.userId !== userId) {
      return NextResponse.json({ error: 'Waitlist not found or forbidden' }, { status: waitlistDetails ? 403 : 404 });
    }

    // No request body needed for this endpoint
    
    const newScore = await calculateAndStoreLeadScore(leadId);

    if (newScore !== null) {
      return NextResponse.json({ newScore: newScore }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to calculate and store lead score' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in POST /api/leads/[leadId]/calculate-score:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
