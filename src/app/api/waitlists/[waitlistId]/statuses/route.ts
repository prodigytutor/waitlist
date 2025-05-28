import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/authUtils';
import { getWaitlistDetails, defineWaitlistStatuses, getWaitlistStatuses, StatusDefinition } from '@/lib/redis'; // Assuming StatusDefinition is exported

// Zod schema for a single status definition
const statusDefinitionSchema = z.object({
  id: z.string().min(1, "Status ID cannot be empty"),
  name: z.string().min(1, "Status name cannot be empty"),
  color: z.string().optional(), // Optional, typically hex
  order: z.number().int(),
});

// Zod schema for an array of status definitions
const statusArraySchema = z.array(statusDefinitionSchema);

interface StatusParams {
  params: {
    waitlistId: string;
  };
}

export async function POST(request: NextRequest, { params }: StatusParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { waitlistId } = params;
    if (!waitlistId) {
      return NextResponse.json({ error: 'Waitlist ID is required' }, { status: 400 });
    }

    const waitlist = await getWaitlistDetails(waitlistId);
    if (!waitlist || waitlist.userId !== userId) {
      return NextResponse.json({ error: 'Waitlist not found or forbidden' }, { status: waitlist ? 403 : 404 });
    }

    const body = await request.json();
    const parsedStatuses = statusArraySchema.safeParse(body);

    if (!parsedStatuses.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsedStatuses.error.issues }, { status: 400 });
    }

    // Ensure IDs are unique within the provided array
    const statusIds = new Set<string>();
    for (const status of parsedStatuses.data) {
        if (statusIds.has(status.id)) {
            return NextResponse.json({ error: `Duplicate status ID found: ${status.id}` }, { status: 400 });
        }
        statusIds.add(status.id);
    }
    
    // Ensure orders are unique
    const statusOrders = new Set<number>();
     for (const status of parsedStatuses.data) {
        if (statusOrders.has(status.order)) {
            return NextResponse.json({ error: `Duplicate status order found: ${status.order}` }, { status: 400 });
        }
        statusOrders.add(status.order);
    }


    const success = await defineWaitlistStatuses(waitlistId, parsedStatuses.data as Array<StatusDefinition>);
    if (success) {
      // Re-fetch to return the defined statuses, ordered as they are stored.
      const definedStatuses = await getWaitlistStatuses(waitlistId);
      return NextResponse.json(definedStatuses, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to define waitlist statuses' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in POST /api/waitlists/[waitlistId]/statuses:`, error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: StatusParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { waitlistId } = params;
    if (!waitlistId) {
      return NextResponse.json({ error: 'Waitlist ID is required' }, { status: 400 });
    }

    const waitlist = await getWaitlistDetails(waitlistId);
    if (!waitlist || waitlist.userId !== userId) {
      return NextResponse.json({ error: 'Waitlist not found or forbidden' }, { status: waitlist ? 403 : 404 });
    }

    const statuses = await getWaitlistStatuses(waitlistId);
    return NextResponse.json(statuses, { status: 200 });

  } catch (error) {
    console.error(`Error in GET /api/waitlists/[waitlistId]/statuses:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
