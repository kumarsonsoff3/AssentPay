"use client";
import { Spinner } from "@/components/feedback/feedback";
import { InlineFeedback } from "@/components/feedback/feedback";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "./client";
import styles from "./onboarding.module.css";
type LinkInvite = {
  teamId: string;
  membershipId: string;
  userId: string;
  secret: string;
};
export function InvitationView({
  invitation,
  saved,
  signedIn,
  email,
  verified,
}: {
  invitation: LinkInvite | null;
  saved: boolean;
  signedIn: boolean;
  email?: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(accept: boolean) {
    setBusy(true);
    setError("");
    try {
      if (invitation) {
        await post("/api/invitations/remember", invitation);
        window.history.replaceState(null, "", "/invitations/accept");
      }
      if (accept) {
        const result = await post("/api/invitations/accept");
        window.location.assign(result.redirect!);
      } else router.push(signedIn ? "/verify-email" : "/sign-in");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function dismiss() {
    await post("/api/invitations/dismiss");
    router.push("/dashboard");
  }
  return (
    <div className={styles.invitePage}>
      <div className={styles.eyebrow}>YOU’RE INVITED</div>
      <h1>A place on the team.</h1>
      <p>
        {invitation || saved
          ? "Accept your workspace invitation using the email address it was sent to."
          : "Reopen the invitation link from your email. It may have expired or already been accepted."}
      </p>
      {email && (
        <p>
          Signed in as <strong>{email}</strong>
        </p>
      )}
      {error && (
        <InlineFeedback>{error}</InlineFeedback>
      )}
      {(invitation || saved) && (
        <button
          className={styles.primary}
          disabled={busy}
          onClick={() => void act(signedIn && verified)}
        >{busy && <Spinner size={15}/>} 
          {busy
            ? "Please wait…"
            : signedIn && verified
              ? "Accept invitation"
              : signedIn
                ? "Verify email to continue"
                : "Sign in to accept"}
        </button>
      )}
      {signedIn && (
        <button className={styles.textButton} onClick={() => void dismiss()}>
          Return to my workspace
        </button>
      )}
      {!signedIn && (
        <p className={styles.note}>
          New here? Save the invitation with the button above. If you have not
          set a password, use{" "}
          <Link href="/forgot-password">Forgot password</Link> with the invited
          email address, then sign in and verify your email.
        </p>
      )}
    </div>
  );
}
