import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/authUtils';
import { getLeadDetails, updateLeadStatus, getWaitlistDetails, getWaitlistStatuses } from '@/lib/redis'; // Assuming StatusDefinition is exported

const updateStatusSchema = z.object({
  statusId: z.string().min(1, "Status ID cannot be empty"),
});

interface LeadStatusParams {
  params: {
    leadId: string;
  };
}

export async function PUT(request: NextRequest, { params }: LeadStatusParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = params;
    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const leadDetails = await getLeadDetails(leadId);
    if (!leadDetails || !leadDetails.originalWaitlistId) {
      return NextResponse.json({ error: 'Lead not found or missing original waitlist ID' }, { status: 404 });
    }

    const waitlistDetails = await getWaitlistDetails(leadDetails.originalWaitlistId);
    if (!waitlistDetails || waitlistDetails.userId !== userId) {
      return NextResponse.json({ error: 'Waitlist not found or forbidden' }, { status: waitlistDetails ? 403 : 404 });
    }

    const body = await request.json();
    const parsedStatus = updateStatusSchema.safeParse(body);

    if (!parsedStatus.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsedStatus.error.issues }, { status: 400 });
    }

    const { statusId } = parsedStatus.data;

    // Optional: Validate if the statusId is valid for the waitlist
    const validStatuses = await getWaitlistStatuses(leadDetails.originalWaitlistId);
    if (!validStatuses.find(s => s.id === statusId)) {
        return NextResponse.json({ error: `Invalid status ID: ${statusId} for this lead's waitlist.` }, { status: 400 });
    }

    const success = await updateLeadStatus(leadId, statusId);
    if (success) {
      return NextResponse.json({ success: true, message: 'Lead status updated successfully' }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to update lead status' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in PUT /api/leads/[leadId]/status:`, error);
     if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
