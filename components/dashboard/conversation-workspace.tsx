"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Inbox,
  Mail,
  Search,
  ShieldCheck,
} from "@/components/icons";
import {
  avatarTone,
  displayTime,
  initials,
  senderName,
} from "./workspace-presenters";
import { InlineFeedback, Spinner } from "@/components/feedback/feedback";
import ui from "./workspace-content.module.css";
type Message = Record<string, unknown> & { id: string };
const value = (item: Message, key: string) =>
  typeof item[key] === "string" ? (item[key] as string) : "";
export function ConversationWorkspace({
  items,
  nextCursor,
  busy,
  more,
  feedback,
  feedbackFailed,
  sync,
  timeZone = "UTC",
}: {
  items: Message[];
  nextCursor: string | null;
  busy: boolean;
  more: () => void;
  feedback: string;
  feedbackFailed: boolean;
  sync?: () => void;
  timeZone?: string;
}) {
  const params = useSearchParams();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selectedId, setSelectedId] = useState(params.get("message") || "");
  const filtered = items.filter(
    item =>
      ["sender", "subject", "text", "snippet"].some(key =>
        value(item, key).toLowerCase().includes(query.toLowerCase()),
      ) &&
      (filter !== "unread" || item.unread === true) &&
      (filter !== "financial" || item.financial === true),
  );
  const selected = filtered.find(item => item.id === selectedId) || filtered[0];
  return (
    <section className={ui.inboxShell} aria-label="Workspace conversations">
      <div className={ui.inboxHeading}>
        <div className={ui.headingIdentity}>
          <span className={`${ui.eventIcon} ${ui.blue}`}>
            <Inbox size={21} />
          </span>
          <div>
            <h2>
              Workspace inbox{" "}
              <span>
                {items.length}
                {nextCursor ? "+" : ""}
              </span>
            </h2>
            <p>Your conversations. The full picture.</p>
          </div>
        </div>
        <div className={ui.headingActions}>
          {sync && (
            <button className={ui.syncButton} disabled={busy} onClick={sync}>
              {busy && <Spinner size={14} />}Sync Gmail
            </button>
          )}
          <Link href="/dashboard/integrations" className={ui.setupLink}>
            Inbox settings <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className={ui.inboxToolbar}>
        <label className={ui.search}>
          <Search size={17} />
          <span className="sr-only">Search conversations</span>
          <input
            type="search"
            placeholder="Search sender, subject or message…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <div className={ui.filters} aria-label="Filter conversations">
          {[
            { id: "all", label: "All messages", count: items.length },
            {
              id: "unread",
              label: "Unread",
              count: items.filter(item => item.unread).length,
            },
            {
              id: "financial",
              label: "Financial",
              count: items.filter(item => item.financial).length,
            },
          ].map(tab => (
            <button
              key={tab.id}
              aria-pressed={filter === tab.id}
              className={filter === tab.id ? ui.activeFilter : ""}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>
      {feedback && (
        <InlineFeedback tone={feedbackFailed ? "error" : "success"}>
          {feedback}
        </InlineFeedback>
      )}
      {items.length ? (
        <div className={ui.mailLayout}>
          <div className={ui.mailList}>
            <div className={ui.listLabel}>
              {filtered.length} conversation{filtered.length === 1 ? "" : "s"}
              <span>Newest first</span>
            </div>
            {filtered.map(item => (
              <button
                key={item.id}
                className={`${ui.mailRow} ${selected?.id === item.id ? ui.selectedRow : ""}`}
                aria-pressed={selected?.id === item.id}
                onClick={() => setSelectedId(item.id)}
              >
                <span
                  className={`${ui.avatar} ${ui[avatarTone(value(item, "sender"))]}`}
                >
                  {initials(value(item, "sender"))}
                </span>
                <span className={ui.mailSummary}>
                  <span className={ui.senderLine}>
                    <strong>{senderName(value(item, "sender"))}</strong>
                    <time dateTime={value(item, "receivedAt")}>
                      {displayTime(value(item, "receivedAt"), timeZone)}
                    </time>
                  </span>
                  <span className={ui.mailSubject}>
                    {value(item, "subject") || "No subject"}
                  </span>
                  <span className={ui.excerpt}>
                    {value(item, "snippet") ||
                      value(item, "text") ||
                      "No message preview available."}
                  </span>
                  <span className={ui.mailTags}>
                    {item.unread === true && (
                      <span className={ui.unreadLabel}>
                        <i />
                        Unread
                      </span>
                    )}
                    {item.financial === true && (
                      <span className={`${ui.badge} ${ui.amber}`}>
                        Financial terms
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
            {!filtered.length && (
              <div className={ui.empty}>
                <Search size={24} />
                <h3>No matching conversations</h3>
                <p>Try a different search or filter.</p>
                <button
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {nextCursor && (
              <button className={ui.loadMore} disabled={busy} onClick={more}>
                {busy ? <Spinner size={15} /> : <ArrowDown size={15} />}Load
                more messages
              </button>
            )}
          </div>
          {selected ? (
            <article className={ui.messagePane} key={selected.id}>
              <header className={ui.messageHeading}>
                <div className={ui.messageEyebrow}>
                  <span>
                    <Mail size={13} />
                    Received email
                  </span>
                  {selected.financial === true && (
                    <span className={`${ui.badge} ${ui.amber}`}>
                      Financial terms detected
                    </span>
                  )}
                </div>
                <h3>{value(selected, "subject") || "No subject"}</h3>
                <div className={ui.messageSender}>
                  <span
                    className={`${ui.avatar} ${ui[avatarTone(value(selected, "sender"))]}`}
                  >
                    {initials(value(selected, "sender"))}
                  </span>
                  <div>
                    <strong>{senderName(value(selected, "sender"))}</strong>
                    <p>{value(selected, "sender")}</p>
                  </div>
                </div>
                <dl className={ui.messageMeta}>
                  <div>
                    <dt>To</dt>
                    <dd>{value(selected, "to") || "Workspace inbox"}</dd>
                  </div>
                  <div>
                    <dt>Received</dt>
                    <dd>
                      <time dateTime={value(selected, "receivedAt")}>
                        {displayTime(
                          value(selected, "receivedAt"),
                          timeZone,
                          true,
                        )}{" "}
                        <span>({timeZone})</span>
                      </time>
                    </dd>
                  </div>
                </dl>
              </header>
              <div className={ui.messageBody}>
                {value(selected, "text") ||
                  value(selected, "snippet") ||
                  "This message has no text content."}
              </div>
              <footer className={ui.messageNote}>
                <ShieldCheck size={15} />
                <p>
                  Original email content. Review the sender and any financial
                  terms before taking action.
                </p>
              </footer>
            </article>
          ) : (
            <div className={ui.empty}>
              <Mail size={28} />
              <h3>Select a conversation</h3>
              <p>Your message will appear here.</p>
            </div>
          )}
        </div>
      ) : (
        <div className={ui.empty}>
          <span className={`${ui.eventIcon} ${ui.blue}`}>
            <Inbox size={26} />
          </span>
          <h3>Your useful financial conversations appear here.</h3>
          <p>
            Forward business email for analysis. Conversations appear here once
            financial intent is identified; unrelated and pending messages stay
            out of this view.
          </p>
          <Link href="/dashboard/integrations">
            Set up workspace email <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
      <div className={ui.inboxFoot}>
        <ShieldCheck size={14} />
        Only the emails you choose to forward appear here.
      </div>
    </section>
  );
}
