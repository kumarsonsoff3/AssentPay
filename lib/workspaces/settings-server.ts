import "server-only";
import { Query, type Users, type Models } from "node-appwrite";
export async function scanMemberships(users: Users, userId: string) {
  const result: Models.Membership[] = [];
  let cursor: string | undefined;
  do {
    const page = await users.listMemberships({ userId, queries: [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    result.push(...page.memberships);
    cursor = page.memberships.length === 100 ? page.memberships.at(-1)?.$id : undefined;
  } while (cursor);
  return result;
}
