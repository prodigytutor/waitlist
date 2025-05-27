import { Redis } from "@upstash/redis";
import { v4 as uuidv4 } from "uuid";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Key Prefixes for multi-tenancy
export const USER_WAITLISTS_KEY_PREFIX = "user:"; // e.g., user:{userId}:waitlists
export const WAITLIST_DETAILS_KEY_PREFIX = "waitlist:"; // e.g., waitlist:{waitlistId}:details
export const WAITLIST_EMAILS_KEY_PREFIX = "waitlist_emails:"; // e.g., waitlist_emails:{waitlistId}
export const WAITLIST_TIMESTAMPS_KEY_PREFIX = "waitlist_timestamps:"; // e.g., waitlist_timestamps:{waitlistId}

export async function addToWaitlist(waitlistId: string, email: string): Promise<boolean> {
  try {
    const emailsKey = `${WAITLIST_EMAILS_KEY_PREFIX}${waitlistId}`;
    const timestampsKey = `${WAITLIST_TIMESTAMPS_KEY_PREFIX}${waitlistId}`;

    const exists = await redis.sismember(emailsKey, email);
    if (exists) {
      return false; // Email already in this specific waitlist
    }
    await redis.sadd(emailsKey, email);

    await redis.hset(timestampsKey, {
      [email]: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error(`Error adding email to waitlist ${waitlistId}:`, error);
    return false;
  }
}

export async function getLeadsForWaitlist(waitlistId: string): Promise<Array<{email: string, joinedAt: string}>> {
  try {
    const timestampsKey = `${WAITLIST_TIMESTAMPS_KEY_PREFIX}${waitlistId}`;
    const timestamps = await redis.hgetall<Record<string, string>>(timestampsKey);

    if (!timestamps) {
      return []; // No leads or hash doesn't exist
    }

    const leads = Object.entries(timestamps).map(([email, joinedAt]) => ({
      email,
      joinedAt,
    }));

    // Optional: Sort leads by joinedAt date if needed, for example, newest first
    // leads.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    return leads;
  } catch (error) {
    console.error(`Error getting leads for waitlist ${waitlistId}:`, error);
    return [];
  }
}

export async function getWaitlistCount(waitlistId: string): Promise<number> {
  try {
    const emailsKey = `${WAITLIST_EMAILS_KEY_PREFIX}${waitlistId}`;
    const count = await redis.scard(emailsKey);
    return count as number;
  } catch (error) {
    console.error(`Error getting waitlist count for ${waitlistId}:`, error);
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
  try {
    const waitlistDetailsKey = `${WAITLIST_DETAILS_KEY_PREFIX}${waitlistId}`;
    const storedUserId = await redis.hget(waitlistDetailsKey, "userId");

    if (storedUserId !== userId) {
      console.warn(`Unauthorized attempt to delete waitlist ${waitlistId} by user ${userId}`);
      return false;
    }

    const emailsKey = `${WAITLIST_EMAILS_KEY_PREFIX}${waitlistId}`;
    const timestampsKey = `${WAITLIST_TIMESTAMPS_KEY_PREFIX}${waitlistId}`;
    const userWaitlistsKey = `${USER_WAITLISTS_KEY_PREFIX}${userId}:waitlists`;

    const pipeline = redis.multi();
    pipeline.del(waitlistDetailsKey);
    pipeline.del(emailsKey);
    pipeline.del(timestampsKey);
    pipeline.srem(userWaitlistsKey, waitlistId);
    await pipeline.exec();

    return true;
  } catch (error) {
    console.error(`Error deleting waitlist ${waitlistId} for user ${userId}:`, error);
    return false;
  }
}

export async function removeLeadFromWaitlist(waitlistId: string, email: string): Promise<boolean> {
  try {
    const emailsKey = `${WAITLIST_EMAILS_KEY_PREFIX}${waitlistId}`;
    const timestampsKey = `${WAITLIST_TIMESTAMPS_KEY_PREFIX}${waitlistId}`;

    const sremResult = await redis.srem(emailsKey, email);
    await redis.hdel(timestampsKey, email);

    return sremResult > 0; // SREM returns the number of members removed.
  } catch (error) {
    console.error(`Error removing lead ${email} from waitlist ${waitlistId}:`, error);
    return false;
  }
}
