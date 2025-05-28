import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/authUtils';
import { 
  getWaitlistDetails, 
  defineScoringRules, 
  getScoringRules,
  ScoringRule, // Assuming ScoringRule interface is exported from lib/redis
  ScoringRuleCondition,
  ScoringRuleConditionGroup
} from '@/lib/redis';

// Zod schema for a single scoring rule condition
const scoringRuleConditionSchema = z.object({
  fieldId: z.string().min(1),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'is_set', 'is_not_set', 'greater_than', 'less_than', 'domain_equals', 'domain_not_equals']),
  value: z.any().optional(), // Value can be string, number, boolean, etc. Further validation might be needed based on type/operator
});

// Zod schema for a scoring rule condition group
const scoringRuleConditionGroupSchema = z.object({
  logicalOperator: z.enum(['AND', 'OR']),
  conditions: z.array(scoringRuleConditionSchema).min(1, "At least one condition is required in a group"),
});

// Zod schema for a single scoring rule
const scoringRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID cannot be empty"),
  description: z.string().optional(),
  points: z.number(),
  conditionGroup: scoringRuleConditionGroupSchema,
});

// Zod schema for an array of scoring rules
const scoringRuleArraySchema = z.array(scoringRuleSchema);

interface ScoringParams {
  params: {
    waitlistId: string;
  };
}

export async function POST(request: NextRequest, { params }: ScoringParams) {
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
    const parsedRules = scoringRuleArraySchema.safeParse(body);

    if (!parsedRules.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsedRules.error.issues }, { status: 400 });
    }
    
    // Ensure ruleIds are unique within the provided array
    const ruleIds = new Set<string>();
    for (const rule of parsedRules.data) {
        if (ruleIds.has(rule.ruleId)) {
            return NextResponse.json({ error: `Duplicate rule ID found: ${rule.ruleId}` }, { status: 400 });
        }
        ruleIds.add(rule.ruleId);
    }

    // Type assertion needed as parsedRules.data is inferred from Zod schema,
    // but defineScoringRules expects Array<ScoringRule> from lib/redis
    const success = await defineScoringRules(waitlistId, parsedRules.data as Array<ScoringRule>); 
    
    if (success) {
      const definedRules = await getScoringRules(waitlistId); // Re-fetch to confirm
      return NextResponse.json(definedRules, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to define scoring rules' }, { status: 500 });
    }
  } catch (error) {
    console.error(`Error in POST /api/waitlists/[waitlistId]/scoring/rules:`, error);
    if (error instanceof SyntaxError) { // From await request.json()
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: ScoringParams) {
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

    const rules = await getScoringRules(waitlistId);
    if (rules === null) { // getScoringRules returns null on error, empty array if no rules
        return NextResponse.json({ error: 'Failed to retrieve scoring rules' }, { status: 500 });
    }
    return NextResponse.json(rules, { status: 200 });

  } catch (error) {
    console.error(`Error in GET /api/waitlists/[waitlistId]/scoring/rules:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
