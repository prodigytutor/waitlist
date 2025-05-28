import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/authUtils';
import { getWaitlistDetails, defineCustomFields, getCustomFieldDefinitions, CustomFieldDefinition } from '@/lib/redis'; // Assuming CustomFieldDefinition is exported

// Zod schema for a single custom field definition
const customFieldDefinitionSchema = z.object({
  id: z.string().min(1, "Custom field ID cannot be empty"), // Consider regex for valid Redis key chars if not UUID
  name: z.string().min(1, "Custom field name cannot be empty"),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  order: z.number().int(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(), // Required if type is 'select', but can be empty array
  placeholder: z.string().optional(),
}).refine(data => { // Ensure options are present if type is 'select'
  if (data.type === 'select' && (!data.options || data.options.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Options are required for select type custom fields and cannot be empty.",
  path: ["options"], // Path of the error
});

// Zod schema for an array of custom field definitions
const customFieldArraySchema = z.array(customFieldDefinitionSchema);

interface CustomFieldParams {
  params: {
    waitlistId: string;
  };
}

export async function POST(request: NextRequest, { params }: CustomFieldParams) {
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
    const parsedDefinitions = customFieldArraySchema.safeParse(body);

    if (!parsedDefinitions.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsedDefinitions.error.issues }, { status: 400 });
    }

    // Ensure IDs are unique within the provided array
    const fieldIds = new Set<string>();
    for (const field of parsedDefinitions.data) {
        if (fieldIds.has(field.id)) {
            return NextResponse.json({ error: `Duplicate custom field ID found: ${field.id}` }, { status: 400 });
        }
        fieldIds.add(field.id);
    }
    
    // Ensure orders are unique
    const fieldOrders = new Set<number>();
     for (const field of parsedDefinitions.data) {
        if (fieldOrders.has(field.order)) {
            return NextResponse.json({ error: `Duplicate custom field order found: ${field.order}` }, { status: 400 });
        }
        fieldOrders.add(field.order);
    }

    const success = await defineCustomFields(waitlistId, parsedDefinitions.data as Array<CustomFieldDefinition>);
    if (success) {
      // Re-fetch to return the defined fields, ordered as they are stored.
      const definedFields = await getCustomFieldDefinitions(waitlistId);
      return NextResponse.json(definedFields, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to define custom fields' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in POST /api/waitlists/[waitlistId]/customfields/definitions:`, error);
     if (error instanceof SyntaxError) { // From await request.json()
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: CustomFieldParams) {
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

    const definitions = await getCustomFieldDefinitions(waitlistId);
    return NextResponse.json(definitions, { status: 200 });

  } catch (error) {
    console.error(`Error in GET /api/waitlists/[waitlistId]/customfields/definitions:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
