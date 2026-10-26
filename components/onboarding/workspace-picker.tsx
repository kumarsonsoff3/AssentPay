"use client";
import { InlineFeedback } from "@/components/feedback/feedback";
import { Spinner } from "@/components/feedback/feedback";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  FolderKanban,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "@/components/icons";
import type { Workspace } from "@/lib/workspaces/types";
import { WorkspaceCardMenu } from "@/components/settings/workspace-card-menu";
import { post } from "./client";
import styles from "./onboarding.module.css";
export function WorkspacePicker({
  workspaces,
  name,
  connectionFailed = false,
}: {
  workspaces: Workspace[];
  name: string;
  connectionFailed?: boolean;
}) {
  const router = useRouter(),
    nameRef = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  async function select(id: string) {
    setBusy(id);
    setError("");
    try {
      const r = await post(`/api/workspaces/${id}/select`);
      router.push(r.redirect!);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy("create");
    setError("");
    try {
      const r = await post("/api/workspaces", { name: data.get("name") });
      router.push(`/workspaces/${r.workspace!.id}/setup`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className={styles.picker}>
      <div className={styles.pageHeading}>
        <div>
          <div className={styles.eyebrow}>
            <span />
            YOUR BUSINESS HUB
          </div>
          <h1>
            Your workspaces<span>.</span>
          </h1>
          <p className={styles.lead}>
            Good to see you{name ? `, ${name.split(" ")[0]}` : ""}. Choose where
            you’d like to work.
          </p>
        </div>
        <button
          className={styles.primary}
          onClick={() => nameRef.current?.focus()}
        >
          <Plus size={17} />
          New workspace
        </button>
      </div>
      <div className={styles.pickerBanner}>
        <div className={styles.bannerCopy}>
          <span className={styles.bannerBadge}>
            <Sparkles size={13} />A LITTLE MORE CONNECTED
          </span>
          <h2>
            A home for the way
            <br />
            your business works.
          </h2>
          <p>
            One workspace for your people, connected tools, and what comes next.
          </p>
          <div className={styles.bannerBenefits}>
            <span>
              <Check size={13} />
              Your team
            </span>
            <span>
              <Check size={13} />
              Your tools
            </span>
            <span>
              <Check size={13} />
              Your control
            </span>
          </div>
        </div>
        <div className={styles.bannerArt} aria-hidden="true">
          <div className={styles.artOrbit} />
          <div className={styles.artTile}>
            <Building2 size={29} />
          </div>
          <span className={styles.artTileSmall}>
            <Users size={19} />
          </span>
          <span className={styles.artTileCheck}>
            <Check size={17} />
          </span>
          <div className={styles.artCaption}>
            <span />
            Workspace connected
          </div>
        </div>
      </div>
      {connectionFailed && (
        <p role="alert" className={styles.error}>
          We couldn’t finish that connection. Open your workspace to try again.
        </p>
      )}
      {error && (
        <InlineFeedback>{error}</InlineFeedback>
      )}
      <div className={styles.pickerGrid}>
        <section>
          <div className={styles.sectionHeading}>
            <h2>
              Your workspaces <span>{workspaces.length}</span>
            </h2>
            <span>PRIVATE TO YOUR TEAM</span>
          </div>
          {workspaces.length ? (
            <div className={styles.workspaceList}>
              {workspaces.map((w, i) => (
                <article className={styles.workspaceCardFrame} key={w.id}>
                <div className={styles.workspaceCardMenu}><WorkspaceCardMenu workspace={w} disabled={!!busy} /></div>
                <button
                  className={styles.workspaceCard}
                  key={w.id}
                  aria-label={`Open ${w.name}`}
                  aria-busy={busy === w.id}
                  disabled={!!busy}
                  onClick={() => void select(w.id)}
                >
                  <div className={styles.workspaceCardTop}>
                    <span className={styles.workspaceIcon} data-tone={i % 3}>
                      <Building2 size={24} />
                    </span>
                    <span className={styles.roleTag}>{w.role}</span>
                  </div>
                  <h3>{w.name}</h3>
                  <p>{w.businessName || "Your business workspace"}</p>
                  <div className={styles.workspaceCardFoot}>
                    <span
                      className={
                        w.onboardingComplete
                          ? styles.readyStatus
                          : styles.setupStatus
                      }
                    >
                      <span />
                      {w.onboardingComplete
                        ? "Ready to open"
                        : "Setup in progress"}
                    </span>
                    {busy === w.id ? (
                      <Spinner size={18}/>
                    ) : (
                      <ArrowRight size={18} />
                    )}
                  </div>
                </button>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <FolderKanban size={27} />
              </span>
              <h3>Your next chapter starts here.</h3>
              <p>
                Create your first workspace, or open an invitation from your
                team to join theirs.
              </p>
              <span className={styles.emptyHint}>
                A fresh space. Built around your business.
              </span>
            </div>
          )}
        </section>
        <section className={styles.createCard}>
          <span className={styles.createLabel}>MAKE IT YOURS</span>
          <span className={styles.iconSquare}>
            <Plus size={23} />
          </span>
          <h2>Create a workspace</h2>
          <p>
            A dedicated space for your business, with its own people and
            connections.
          </p>
          <form method="post" action="/api/forms/unavailable" onSubmit={create}>
            <label htmlFor="workspace-name">Workspace name</label>
            <input
              ref={nameRef}
              id="workspace-name"
              name="name"
              required
              maxLength={128}
              placeholder="e.g. Acme Studio"
              autoComplete="organization"
            />
            <button className={styles.primary} disabled={!!busy}>
              {busy === "create" ? "Creating workspace…" : "Create workspace"}
              <ArrowRight size={16} />
            </button>
          </form>
          <div className={styles.createFoot}>
            <ShieldCheck size={16} />
            <small>
              You’re the owner. Your workspace stays private to the people you
              invite.
            </small>
          </div>
        </section>
      </div>
      <div className={styles.pageFooter}>
        <span>
          <ShieldCheck size={14} /> Built for your business. Designed for your
          peace of mind.
        </span>
        <span>ASSENTPAY</span>
      </div>
    </div>
  );
}
