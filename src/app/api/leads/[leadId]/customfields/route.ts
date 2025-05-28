import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/authUtils';
import { 
  getLeadDetails, 
  getWaitlistDetails, 
  updateLeadCustomFieldValues,
  getCustomFieldDefinitions // For advanced validation
} from '@/lib/redis';

// Basic Zod schema for the request body
const customFieldsUpdateSchema = z.record(z.string(), z.string()); // Allows any string key with string value

interface LeadCustomFieldsParams {
  params: {
    leadId: string;
  };
}

export async function PUT(request: NextRequest, { params }: LeadCustomFieldsParams) {
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
    const parsedCustomFields = customFieldsUpdateSchema.safeParse(body);

    if (!parsedCustomFields.success) {
      return NextResponse.json({ error: 'Invalid request body format', issues: parsedCustomFields.error.issues }, { status: 400 });
    }

    let validatedValues = parsedCustomFields.data;

    // --- Placeholder for Advanced Validation ---
    // 1. Fetch custom field definitions for leadDetails.originalWaitlistId
    // const fieldDefinitions = await getCustomFieldDefinitions(leadDetails.originalWaitlistId);
    // if (!fieldDefinitions) { /* handle error or empty definitions */ }
    //
    // 2. Iterate through parsedCustomFields.data:
    //    For each fieldId and value:
    //    a. Find the corresponding definition in fieldDefinitions.
    //    b. If no definition, perhaps reject or ignore.
    //    c. Validate value against definition.type (e.g., isNaN for number, Date.parse for date, check options for select).
    //    d. If validation fails, collect errors and return 400.
    //    e. If required and value is empty, collect errors.
    //
    // For this subtask, we'll proceed with basic validation (structure is Record<string, string>).
    // --- End Placeholder ---

    const success = await updateLeadCustomFieldValues(leadId, validatedValues);
    if (success) {
      return NextResponse.json({ success: true, message: 'Lead custom fields updated successfully' }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to update lead custom fields' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in PUT /api/leads/[leadId]/customfields:`, error);
    if (error instanceof SyntaxError) { // From await request.json()
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
