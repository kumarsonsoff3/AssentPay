import "server-only";
import { Account, AppwriteException, Client, type Models } from "node-appwrite";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig, SESSION_COOKIE } from "./config";

// Never share a mutable Appwrite client between requests or users.
export function createAccount(session?: string, admin = false) {
  const config = authConfig();
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.project);
  if (session) client.setSession(session);
  else if (admin) client.setKey(config.key);
  return new Account(client);
}

export async function saveSession(session: Models.Session) {
  if (!session.secret)
    throw new Error(
      "Appwrite did not return a session secret. Check the sessions.write API key scope.",
    );
  (await cookies()).set(SESSION_COOKIE, session.secret, {
    httpOnly: true,
    secure: authConfig().secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expire),
  });
}

export const getCurrentUser = cache(async () => {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    return await createAccount(session).get();
  } catch (error) {
    if (error instanceof AppwriteException && [401, 403].includes(error.code))
      return null;
    throw error;
  }
});

// Use this at every protected page, action, and data boundary; a layout alone is insufficient.
export async function requireVerifiedUser() {
  const user = await getCurrentUser();
  if (!user || !user.status) redirect("/sign-in");
  if (!user.emailVerification) redirect("/verify-email");
  return user;
}
