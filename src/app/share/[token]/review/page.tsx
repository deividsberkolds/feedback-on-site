"use client";

import { useEffect, useMemo, useState, use } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type CommentView = {
  id: string;
  text: string;
  authorName: string | null;
  pageUrl: string;
  createdAt: string;
};

export default function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [defaultUrl, setDefaultUrl] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewerName, setReviewerName] = useState<string>("");

  useEffect(() => {
    fetch(`/api/sessions/${token}/state`)
      .then((r) => r.json())
      .then(
        (d: {
          defaultUrl?: string;
          reviewerName?: string | null;
          comments?: CommentView[];
        }) => {
          setDefaultUrl(d.defaultUrl ?? null);
          setReviewerName(d.reviewerName ?? "");
          setComments(d.comments ?? []);
        },
      )
      .catch(() => undefined);
  }, [token]);

  const proxySrc = useMemo(() => {
    const url = currentUrl ?? defaultUrl;
    if (!url) return null;
    return `/api/proxy?${new URLSearchParams({ url, token }).toString()}`;
  }, [currentUrl, defaultUrl, token]);

  // Listen for messages from the annotator inside the iframe.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.__annotator !== true) return;
      if (data.type === "comment_added" && data.comment) {
        setComments((prev) => [data.comment as CommentView, ...prev]);
      } else if (data.type === "navigated" && data.url) {
        setCurrentUrl(data.url);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  async function submitReview() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${token}/submit`, {
        method: "POST",
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const t = await res.text();
        alert(`Failed to submit: ${t}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="text-muted-foreground">
          Your feedback has been submitted. You can close this tab.
        </p>
      </main>
    );
  }

  if (!proxySrc) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Feedback</span>
            <Badge variant="secondary">{comments.length} comments</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Your name"
              className="h-7 w-40 text-xs"
              onBlur={() => {
                fetch(`/api/sessions/${token}/state`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ reviewerName }),
                }).catch(() => undefined);
              }}
            />
            <Button onClick={submitReview} disabled={submitting} size="sm">
              {submitting ? "Submitting…" : "Submit review"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIframeKey((k) => k + 1)}
              title="Reload page"
            >
              ↻
            </Button>
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <iframe
          key={iframeKey}
          src={proxySrc}
          className="flex-1 border-r"
          title="Page under review"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
        <aside className="bg-muted/30 w-80 overflow-y-auto border-l">
          <div className="flex flex-col gap-2 p-3">
            <h2 className="text-sm font-medium">Comments</h2>
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Click anywhere on the page to add a comment.
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="bg-background rounded-lg border p-2 text-xs"
                >
                  <div className="text-muted-foreground mb-1">
                    {c.authorName ?? "You"} ·{" "}
                    {new Date(c.createdAt).toLocaleTimeString()}
                  </div>
                  <div className="whitespace-pre-wrap">{c.text}</div>
                  <div
                    className="text-muted-foreground mt-1 truncate"
                    title={c.pageUrl}
                  >
                    {c.pageUrl}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
