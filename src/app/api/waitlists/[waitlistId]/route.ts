import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/authUtils';
import { getWaitlistDetails, deleteWaitlist } from '@/lib/redis';

interface WaitlistParams {
  params: {
    waitlistId: string;
  };
}

export async function GET(request: NextRequest, { params }: WaitlistParams) {
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

    if (!waitlist) {
      return NextResponse.json({ error: 'Waitlist not found' }, { status: 404 });
    }

    if (waitlist.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(waitlist, { status: 200 });
  } catch (error) {
    console.error(`Error in GET /api/waitlists/[waitlistId]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: WaitlistParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { waitlistId } = params;
    if (!waitlistId) {
      return NextResponse.json({ error: 'Waitlist ID is required' }, { status: 400 });
    }

    // deleteWaitlist in redis.ts already checks if the waitlist belongs to the user.
    const success = await deleteWaitlist(userId, waitlistId);

    if (success) {
      return NextResponse.json({ message: 'Waitlist deleted successfully' }, { status: 200 });
    } else {
      // This could be because the waitlist wasn't found or didn't belong to the user.
      // The redis function console.warns for unauthorized attempts.
      return NextResponse.json({ error: 'Failed to delete waitlist or forbidden' }, { status: 403 });
    }
  } catch (error) {
    console.error(`Error in DELETE /api/waitlists/[waitlistId]:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
