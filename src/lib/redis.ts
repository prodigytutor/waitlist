import { Redis } from "@upstash/redis";
import { v4 as uuidv4 } from "uuid";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Key Prefixes for multi-tenancy
export const USER_WAITLISTS_KEY_PREFIX = "user:"; // e.g., user:{userId}:waitlists
export const WAITLIST_DETAILS_KEY_PREFIX = "waitlist:"; // e.g., waitlist:{waitlistId}:details (Used for waitlist metadata)
// New prefixes based on REDIS_DATA_STRUCTURES.md
export const LEAD_DETAILS_PREFIX = "lead:"; // e.g., lead:{leadId}:details
export const WAITLIST_LEADS_PREFIX = "waitlist_leads:"; // e.g., waitlist_leads:{waitlistId} (Set of leadIds)
export const EMAIL_TO_LEADID_PREFIX = "email_to_leadId:"; // e.g., email_to_leadId:{waitlistId}:{email}

// Delete unused old prefixes
// export const WAITLIST_EMAILS_KEY_PREFIX = "waitlist_emails:";
// export const WAITLIST_TIMESTAMPS_KEY_PREFIX = "waitlist_timestamps:";


export async function addToWaitlist(waitlistId: string, email: string): Promise<string | null> {
  try {
    const normalizedEmail = email.toLowerCase();
    const emailToLeadIdKey = `${EMAIL_TO_LEADID_PREFIX}${waitlistId}:${normalizedEmail}`;

    const existingLeadId = await redis.get<string>(emailToLeadIdKey);
    if (existingLeadId) {
      console.log(`Existing lead found for email ${normalizedEmail} on waitlist ${waitlistId}: ${existingLeadId}`);
      return existingLeadId; // Return existing leadId
    }

    const newLeadId = uuidv4();
    const leadDetailsKey = `${LEAD_DETAILS_PREFIX}${newLeadId}:details`;
    const waitlistLeadsKey = `${WAITLIST_LEADS_PREFIX}${waitlistId}`;

    const leadDetails = {
      email: normalizedEmail,
      createdAt: new Date().toISOString(),
      originalWaitlistId: waitlistId,
      currentStatusId: "s_new", // Default initial status
      currentScore: 0,
    };

    const pipeline = redis.multi();
    pipeline.hmset(leadDetailsKey, leadDetails);
    pipeline.sadd(waitlistLeadsKey, newLeadId);
    pipeline.set(emailToLeadIdKey, newLeadId);
    await pipeline.exec();

    return newLeadId;
  } catch (error) {
    console.error(`Error adding email ${email} to waitlist ${waitlistId}:`, error);
    return null;
  }
}

export async function getLeadDetails(leadId: string): Promise<Record<string, any> | null> {
  try {
    const leadDetailsKey = `${LEAD_DETAILS_PREFIX}${leadId}:details`;
    const details = await redis.hgetall<Record<string, any>>(leadDetailsKey);
    return details; // Returns null if key doesn't exist
  } catch (error) {
    console.error(`Error fetching details for lead ${leadId}:`, error);
    return null;
  }
}

export async function getLeadsForWaitlist(waitlistId: string): Promise<Array<Record<string, any>>> {
  try {
    const waitlistLeadsKey = `${WAITLIST_LEADS_PREFIX}${waitlistId}`;
    const leadIds = await redis.smembers(waitlistLeadsKey);

    if (!leadIds || leadIds.length === 0) {
      return [];
    }

    const pipeline = redis.multi();
    leadIds.forEach(leadId => {
      pipeline.hgetall(`${LEAD_DETAILS_PREFIX}${leadId}:details`);
    });
    const results = await pipeline.exec<Array<Record<string, any> | null>>();

    return results.map((details, index) => {
      if (details) { // Check if details is not null
        return { ...details, id: leadIds[index] };
      }
      return null; // Or handle missing details differently, e.g. filter out
    }).filter(lead => lead !== null) as Array<Record<string, any>>; // Filter out nulls and assert type

  } catch (error) {
    console.error(`Error getting leads for waitlist ${waitlistId}:`, error);
    return [];
  }
}


// This function is no longer relevant as individual leads are not counted directly,
// but rather by the number of leadIds in the waitlist_leads:{waitlistId} set.
// A new function getWaitlistLeadCount might be needed if this specific functionality is required.
// For now, it's removed as per shift to leadId model.
// export async function getWaitlistCount(waitlistId: string): Promise<number> {
// try {
// const emailsKey = `${WAITLIST_EMAILS_KEY_PREFIX}${waitlistId}`;
// const count = await redis.scard(emailsKey);
// return count as number;
// } catch (error) {
// console.error(`Error getting waitlist count for ${waitlistId}:`, error);
// return 0;
// }
// }

// New function to count leads for a waitlist
export async function getWaitlistLeadCount(waitlistId: string): Promise<number> {
  try {
    const waitlistLeadsKey = `${WAITLIST_LEADS_PREFIX}${waitlistId}`;
    const count = await redis.scard(waitlistLeadsKey);
    return count;
  } catch (error) {
    console.error(`Error getting lead count for waitlist ${waitlistId}:`, error);
    return 0;
  }
}

// New helper functions:

export async function createWaitlist(userId: string, waitlistName: string): Promise<string | null> {
  try {
    const waitlistId = uuidv4();
    const waitlistDetailsKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}`;
    const userWaitlistsKey = `${USER_WAITLISTS_KEY_PREFIX}${userId}:waitlists`;

    await redis.hmset(waitlistDetailsKey, {
      name: waitlistName,
      createdAt: new Date().toISOString(),
      userId: userId,
    });

    await redis.sadd(userWaitlistsKey, waitlistId);

    return waitlistId;
  } catch (error) {
    console.error(`Error creating waitlist for user ${userId}:`, error);
    return null;
  }
}

export async function getWaitlistsForUser(userId: string): Promise<Array<{id: string, name: string, createdAt: string}>> {
  try {
    const userWaitlistsKey = `${USER_WAITLISTS_KEY_PREFIX}${userId}:waitlists`;
    const waitlistIds = await redis.smembers(userWaitlistsKey);
    const waitlists = [];

    for (const waitlistId of waitlistIds) {
      const waitlistDetailsKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}`;
      const details = await redis.hgetall<{name: string, createdAt: string}>(waitlistDetailsKey);
      if (details) {
        waitlists.push({
          id: waitlistId,
          name: details.name,
          createdAt: details.createdAt,
        });
      }
    }
    return waitlists;
  } catch (error) {
    console.error(`Error getting waitlists for user ${userId}:`, error);
    return [];
  }
}

export async function getWaitlistDetails(waitlistId: string): Promise<{id: string, name: string, createdAt: string, userId: string} | null> {
  try {
    const waitlistDetailsKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}`;
    const details = await redis.hgetall<{name: string, createdAt: string, userId: string}>(waitlistDetailsKey);

    if (details && details.name) { // Check if details exist and have a name (could be an empty hash)
      return {
        id: waitlistId,
        name: details.name,
        createdAt: details.createdAt,
        userId: details.userId,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error getting details for waitlist ${waitlistId}:`, error);
    return null;
  }
}

export async function deleteWaitlist(userId: string, waitlistId: string): Promise<boolean> {
  }
}

export async function deleteWaitlist(userId: string, waitlistId: string): Promise<boolean> {
  try {
    const waitlistDetailsKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}`;
    const waitlistDetails = await redis.hgetall<{ userId: string }>(waitlistDetailsKey);

    if (!waitlistDetails || waitlistDetails.userId !== userId) {
      console.warn(`Unauthorized attempt to delete waitlist ${waitlistId} by user ${userId}`);
      return false;
    }

    const waitlistLeadsKey = `${WAITLIST_LEADS_PREFIX}${waitlistId}`;
    const leadIds = await redis.smembers(waitlistLeadsKey);

    const pipeline = redis.multi();

    if (leadIds && leadIds.length > 0) {
      // Fetch all lead details to get emails for deleting emailToLeadIdKey
      const leadDetailsPipeline = redis.multi();
      leadIds.forEach(leadId => {
        leadDetailsPipeline.hgetall(`${LEAD_DETAILS_PREFIX}${leadId}:details`);
      });
      const allLeadDetails = await leadDetailsPipeline.exec<Array<Record<string, any> | null>>();

      allLeadDetails.forEach((details, index) => {
        const leadId = leadIds[index];
        pipeline.del(`${LEAD_DETAILS_PREFIX}${leadId}:details`);
        pipeline.del(`${LEAD_DETAILS_PREFIX}${leadId}:custom_field_values`); // Anticipating
        if (details && details.email) {
          pipeline.del(`${EMAIL_TO_LEADID_PREFIX}${waitlistId}:${details.email}`);
        }
      });
    }
    
    // Delete waitlist-specific data
    pipeline.del(waitlistLeadsKey);
    pipeline.del(`${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}`); // Main waitlist details
    pipeline.srem(`${USER_WAITLISTS_KEY_PREFIX}${userId}:waitlists`, waitlistId);
    
    // Anticipating future keys for waitlist-specific configurations:
    pipeline.del(`waitlist:${waitlistId}:status_definitions`);
    pipeline.del(`waitlist:${waitlistId}:custom_field_definitions`);
    pipeline.del(`waitlist:${waitlistId}:scoring_rules`);
    // Note: Deleting individual status detail keys (e.g., waitlist:{waitlistId}:status:{statusId}:details)
    // would require fetching status_definitions first. For now, this simplified deletion is acceptable.

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error deleting waitlist ${waitlistId} for user ${userId}:`, error);
    return false;
  }
}

// --- Lead Status Management Functions ---

// Key Prefixes for Statuses (as per subtask description, these are effectively sub-namespaces of a waitlist's configuration)
const STATUS_DEFINITIONS_BASE_KEY = "waitlist"; // waitlist:{waitlistId}:status_definitions
const STATUS_DETAILS_BASE_KEY = "waitlist";   // waitlist:{waitlistId}:status:{statusId}:details

export interface StatusDefinition {
  id: string;
  name: string;
  color?: string;
  order: number;
}

export async function defineWaitlistStatuses(waitlistId: string, statuses: Array<StatusDefinition>): Promise<boolean> {
  try {
    const statusDefinitionsListKey = `${STATUS_DEFINITIONS_BASE_KEY}:${waitlistId}:status_definitions`;

    // Fetch current status IDs to delete their detail hashes
    const currentStatusIds = await redis.lrange(statusDefinitionsListKey, 0, -1);

    const pipeline = redis.multi();

    // Delete old status detail hashes
    if (currentStatusIds && currentStatusIds.length > 0) {
      currentStatusIds.forEach(statusId => {
        pipeline.del(`${STATUS_DETAILS_BASE_KEY}:${waitlistId}:status:${statusId}:details`);
      });
    }

    // Clear the existing list of status definitions
    pipeline.del(statusDefinitionsListKey);

    // Sort statuses by order before processing
    const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);

    // Add new status definitions and their details
    for (const status of sortedStatuses) {
      pipeline.rpush(statusDefinitionsListKey, status.id);
      const statusDetailKey = `${STATUS_DETAILS_BASE_KEY}:${waitlistId}:status:${status.id}:details`;
      const statusDetails: Record<string, any> = {
        name: status.name,
        order: status.order,
      };
      if (status.color) {
        statusDetails.color = status.color;
      }
      pipeline.hmset(statusDetailKey, statusDetails);
    }

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error defining statuses for waitlist ${waitlistId}:`, error);
    return false;
  }
}

export async function getWaitlistStatuses(waitlistId: string): Promise<Array<StatusDefinition>> {
  try {
    const statusDefinitionsListKey = `${STATUS_DEFINITIONS_BASE_KEY}:${waitlistId}:status_definitions`;
    const statusIds = await redis.lrange(statusDefinitionsListKey, 0, -1);

    if (!statusIds || statusIds.length === 0) {
      return [];
    }

    const pipeline = redis.multi();
    statusIds.forEach(statusId => {
      pipeline.hgetall(`${STATUS_DETAILS_BASE_KEY}:${waitlistId}:status:${statusId}:details`);
    });

    const results = await pipeline.exec<Array<Record<string, any> | null>>();

    return results.map((details, index) => {
      if (details) {
        return {
          id: statusIds[index],
          name: details.name as string,
          color: details.color as string | undefined,
          order: parseInt(details.order as string, 10),
        };
      }
      return null; // Should not happen if defineWaitlistStatuses is used correctly
    }).filter(status => status !== null) as Array<StatusDefinition>;

  } catch (error) {
    console.error(`Error getting statuses for waitlist ${waitlistId}:`, error);
    return [];
  }
}

export async function updateLeadStatus(leadId: string, statusId: string): Promise<boolean> {
  try {
    const leadDetailsKey = `${LEAD_DETAILS_PREFIX}${leadId}:details`;
    // Optional: Validate statusId against the lead's originalWaitlistId's statuses
    // const leadInfo = await redis.hgetall<{ originalWaitlistId?: string }>(leadDetailsKey);
    // if (leadInfo && leadInfo.originalWaitlistId) {
    //   const validStatuses = await getWaitlistStatuses(leadInfo.originalWaitlistId);
    //   if (!validStatuses.find(s => s.id === statusId)) {
    //     console.warn(`Invalid statusId ${statusId} for lead ${leadId} on waitlist ${leadInfo.originalWaitlistId}`);
    //     return false;
    //   }
    // } else {
    //   console.warn(`Could not retrieve originalWaitlistId for lead ${leadId} to validate status.`);
    //   // Depending on strictness, might return false or proceed without validation
    // }

    const result = await redis.hset(leadDetailsKey, { currentStatusId: statusId });
    return typeof result === 'number'; // HSET returns number of fields changed
  } catch (error) {
    console.error(`Error updating status for lead ${leadId}:`, error);
    return false;
  }
}

// --- Custom Field Management Functions ---

// Re-use existing prefixes or define specific ones if desired.
// WAITLIST_DETAILS_KEY_PREFIX is "waitlist:"
// LEAD_DETAILS_PREFIX is "lead:"

export interface CustomFieldDefinition {
  id: string; // User-defined or UUID
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  order: number;
  required?: boolean;
  options?: string[]; // For 'select' type
  placeholder?: string;
}

export async function defineCustomFields(waitlistId: string, fieldDefinitions: Array<CustomFieldDefinition>): Promise<boolean> {
  try {
    const customFieldsKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}:custom_field_definitions`;
    const pipeline = redis.multi();

    // Delete the old hash entirely
    pipeline.del(customFieldsKey);

    // Sort by order before creating
    const sortedDefinitions = [...fieldDefinitions].sort((a, b) => a.order - b.order);

    if (sortedDefinitions.length > 0) {
      const fieldsToSet: Record<string, string> = {};
      for (const field of sortedDefinitions) {
        // Ensure all required fields are present, even if optional in the interface for broader use
        const definitionToStore: CustomFieldDefinition = {
          id: field.id,
          name: field.name,
          type: field.type,
          order: field.order,
          required: field.required || false,
          options: field.options || [],
          placeholder: field.placeholder || '',
        };
        fieldsToSet[field.id] = JSON.stringify(definitionToStore);
      }
      pipeline.hmset(customFieldsKey, fieldsToSet);
    }
    // If sortedDefinitions is empty, DEL alone will clear it.

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error defining custom fields for waitlist ${waitlistId}:`, error);
    return false;
  }
}

export async function getCustomFieldDefinitions(waitlistId: string): Promise<Array<CustomFieldDefinition>> {
  try {
    const customFieldsKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}:custom_field_definitions`;
    const definitions = await redis.hgetall<Record<string, string>>(customFieldsKey);

    if (!definitions) {
      return [];
    }

    const fieldArray: CustomFieldDefinition[] = Object.values(definitions)
      .map(jsonString => JSON.parse(jsonString) as CustomFieldDefinition);
    
    // Sort by order, as HGETALL does not guarantee field order
    fieldArray.sort((a, b) => a.order - b.order);

    return fieldArray;
  } catch (error) {
    console.error(`Error getting custom field definitions for waitlist ${waitlistId}:`, error);
    return [];
  }
}

export async function updateLeadCustomFieldValue(leadId: string, fieldId: string, value: string): Promise<boolean> {
  try {
    const customFieldValuesKey = `${LEAD_DETAILS_PREFIX}${leadId}:custom_field_values`;
    await redis.hset(customFieldValuesKey, { [fieldId]: value });
    return true;
  } catch (error) {
    console.error(`Error updating custom field ${fieldId} for lead ${leadId}:`, error);
    return false;
  }
}

export async function updateLeadCustomFieldValues(leadId: string, values: Record<string, string>): Promise<boolean> {
  try {
    if (Object.keys(values).length === 0) {
        return true; // No values to set
    }
    const customFieldValuesKey = `${LEAD_DETAILS_PREFIX}${leadId}:custom_field_values`;
    await redis.hmset(customFieldValuesKey, values);
    return true;
  } catch (error) {
    console.error(`Error updating custom fields for lead ${leadId}:`, error);
    return false;
  }
}

// Modify getLeadDetails to also fetch custom_field_values
export async function getLeadDetails(leadId: string): Promise<Record<string, any> | null> {
  try {
    const leadDetailsKey = `${LEAD_DETAILS_PREFIX}${leadId}:details`;
    const customFieldValuesKey = `${LEAD_DETAILS_PREFIX}${leadId}:custom_field_values`;

    const pipeline = redis.pipeline();
    pipeline.hgetall(leadDetailsKey);
    pipeline.hgetall(customFieldValuesKey);
    
    const [coreDetails, customValues] = await pipeline.exec<[Record<string, any> | null, Record<string, any> | null]>();

    if (!coreDetails) {
      return null; // Lead core details not found
    }

    return {
      ...coreDetails,
      id: leadId, // Ensure leadId is part of the returned object
      customFields: customValues || {}, // Merge custom fields, defaulting to empty object if none
    };
  } catch (error) {
    console.error(`Error fetching details for lead ${leadId}:`, error);
    return null;
  }
}


export async function removeLeadFromWaitlist(waitlistId: string, email: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase();
    const emailToLeadIdKey = `${EMAIL_TO_LEADID_PREFIX}${waitlistId}:${normalizedEmail}`;
    const leadId = await redis.get<string>(emailToLeadIdKey);

    if (!leadId) {
      console.log(`Lead with email ${normalizedEmail} not found on waitlist ${waitlistId} for removal.`);
      return false; // Lead not found
    }

    const pipeline = redis.multi();
    pipeline.del(`${LEAD_DETAILS_PREFIX}${leadId}:details`);
    pipeline.del(`${LEAD_DETAILS_PREFIX}${leadId}:custom_field_values`); // Confirmed: This line is present
    pipeline.srem(`${WAITLIST_LEADS_PREFIX}${waitlistId}`, leadId);
    pipeline.del(emailToLeadIdKey);
    await pipeline.exec();

    return true;
  } catch (error) {
    console.error(`Error removing lead ${email} from waitlist ${waitlistId}:`, error);
    return false;
  }
}

// Verification of deleteWaitlist:
// The key `waitlist:${waitlistId}:custom_field_definitions` is already part of the deleteWaitlist function's pipeline.
// pipeline.del(`waitlist:${waitlistId}:custom_field_definitions`); // This was anticipated and added.


// --- Lead Scoring Functions ---

// WAITLIST_DETAILS_KEY_PREFIX is "waitlist:"
// LEAD_DETAILS_PREFIX is "lead:"

export interface ScoringRuleCondition {
  fieldId: string; // Can be 'currentStatusId' or a custom field ID like 'cf_company_size'
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_set' | 'is_not_set' | 'greater_than' | 'less_than' | 'domain_equals' | 'domain_not_equals';
  value?: any; // Value to compare against. Type depends on operator and field.
}

export interface ScoringRuleConditionGroup {
  logicalOperator: 'AND' | 'OR';
  conditions: ScoringRuleCondition[];
}

export interface ScoringRule {
  ruleId: string;
  description: string;
  points: number;
  conditionGroup: ScoringRuleConditionGroup;
}

export async function defineScoringRules(waitlistId: string, rules: Array<ScoringRule>): Promise<boolean> {
  try {
    const scoringRulesKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}:scoring_rules`;
    await redis.set(scoringRulesKey, JSON.stringify(rules));
    return true;
  } catch (error) {
    console.error(`Error defining scoring rules for waitlist ${waitlistId}:`, error);
    return false;
  }
}

export async function getScoringRules(waitlistId: string): Promise<Array<ScoringRule> | null> {
  try {
    const scoringRulesKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}:scoring_rules`;
    const rulesString = await redis.get<string>(scoringRulesKey);
    if (!rulesString) {
      return []; // No rules defined is not an error, just empty array
    }
    return JSON.parse(rulesString) as Array<ScoringRule>;
  } catch (error) {
    console.error(`Error getting scoring rules for waitlist ${waitlistId}:`, error);
    return null; // Return null on parsing error or other Redis errors
  }
}

function evaluateCondition(leadData: Record<string, any>, condition: ScoringRuleCondition): boolean {
  let fieldValue: any;
  if (condition.fieldId === 'currentStatusId' || condition.fieldId === 'email' || condition.fieldId === 'createdAt' || condition.fieldId === 'originalWaitlistId' || condition.fieldId === 'currentScore') {
    fieldValue = leadData[condition.fieldId];
  } else if (leadData.customFields) {
    fieldValue = leadData.customFields[condition.fieldId];
  }

  const conditionValue = condition.value;

  switch (condition.operator) {
    case 'equals': return fieldValue === conditionValue;
    case 'not_equals': return fieldValue !== conditionValue;
    case 'contains': return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.includes(conditionValue);
    case 'not_contains': return typeof fieldValue === 'string' && typeof conditionValue === 'string' && !fieldValue.includes(conditionValue);
    case 'is_set': return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'is_not_set': return fieldValue === undefined || fieldValue === null || fieldValue === '';
    case 'greater_than':
      // Ensure both are numbers or convertable to numbers/dates for comparison
      if (typeof fieldValue === 'number' && typeof conditionValue === 'number') return fieldValue > conditionValue;
      if (Date.parse(fieldValue) && Date.parse(conditionValue)) return new Date(fieldValue) > new Date(conditionValue);
      return Number(fieldValue) > Number(conditionValue); // Fallback for string numbers
    case 'less_than':
      if (typeof fieldValue === 'number' && typeof conditionValue === 'number') return fieldValue < conditionValue;
      if (Date.parse(fieldValue) && Date.parse(conditionValue)) return new Date(fieldValue) < new Date(conditionValue);
      return Number(fieldValue) < Number(conditionValue);
    case 'domain_equals':
        if (typeof fieldValue === 'string' && fieldValue.includes('@')) {
            return fieldValue.split('@')[1] === conditionValue;
        }
        return false;
    case 'domain_not_equals':
        if (typeof fieldValue === 'string' && fieldValue.includes('@')) {
            return fieldValue.split('@')[1] !== conditionValue;
        }
        return false;
    default: return false;
  }
}

export async function calculateAndStoreLeadScore(leadId: string): Promise<number | null> {
  try {
    const leadData = await getLeadDetails(leadId); // This now includes customFields
    if (!leadData || !leadData.originalWaitlistId) {
      console.warn(`Lead data or originalWaitlistId not found for lead ${leadId}`);
      return null;
    }

    const rules = await getScoringRules(leadData.originalWaitlistId);
    if (!rules || rules.length === 0) {
      // If no rules, ensure score is 0 in DB and return 0
      await redis.hset(`${LEAD_DETAILS_PREFIX}${leadId}:details`, { currentScore: 0 });
      return 0;
    }

    let totalScore = 0;
    for (const rule of rules) {
      let groupResult: boolean;
      if (rule.conditionGroup.logicalOperator === 'AND') {
        groupResult = rule.conditionGroup.conditions.every(condition => evaluateCondition(leadData, condition));
      } else { // OR
        groupResult = rule.conditionGroup.conditions.some(condition => evaluateCondition(leadData, condition));
      }
      if (groupResult) {
        totalScore += rule.points;
      }
    }

    await redis.hset(`${LEAD_DETAILS_PREFIX}${leadId}:details`, { currentScore: totalScore });
    return totalScore;
  } catch (error) {
    console.error(`Error calculating score for lead ${leadId}:`, error);
    return null;
  }
}

export async function getLeadScore(leadId: string): Promise<number | null> {
  try {
    const leadDetailsKey = `${LEAD_DETAILS_PREFIX}${leadId}:details`;
    const score = await redis.hget(leadDetailsKey, 'currentScore');
    if (score === null || score === undefined) { // HGET returns null if field or key doesn't exist
      return null;
    }
    return parseInt(score as string, 10);
  } catch (error) {
    console.error(`Error getting score for lead ${leadId}:`, error);
    return null;
  }
}

// Verification of deleteWaitlist:
// The key `waitlist:{waitlistId}:scoring_rules` is already part of the deleteWaitlist function's pipeline.
// pipeline.del(`waitlist:${waitlistId}:scoring_rules`); // This was anticipated and added.
