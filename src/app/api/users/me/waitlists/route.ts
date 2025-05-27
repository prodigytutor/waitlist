import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/authUtils';
import { createWaitlist, getWaitlistsForUser, getWaitlistDetails } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { waitlistName } = body;

    if (!waitlistName || typeof waitlistName !== 'string') {
      return NextResponse.json({ error: 'Waitlist name is required' }, { status: 400 });
    }

    const waitlistId = await createWaitlist(userId, waitlistName);

    if (waitlistId) {
      const newWaitlist = await getWaitlistDetails(waitlistId);
      if (newWaitlist) {
        return NextResponse.json(newWaitlist, { status: 201 });
      } else {
        console.error(`Failed to retrieve created waitlist with id: ${waitlistId}`);
        return NextResponse.json({ error: 'Failed to retrieve created waitlist' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Failed to create waitlist' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/users/me/waitlists:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const waitlists = await getWaitlistsForUser(userId);
    return NextResponse.json(waitlists, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/users/me/waitlists:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
