"use client";

// PROTOTYPE harness: order detail context + one documents panel variant at a time.
// Picker per the prototype skill's PICKER.md.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Checklist } from "./checklist";
import {
  SCENARIOS,
  docNumber,
  markSent,
  markSupplierTold,
  unlock,
  type DocRef,
  type OrderState,
} from "./model";
import { NextStep } from "./next-step";
import { Paper } from "./paper";
import {
  OrderHeader,
  PreviewDialog,
  SendDialog,
  Toast,
  UnlockDialog,
  useIsPhone,
  type PanelApi,
  type Role,
} from "./shared";
import "./picker.css";

const VARIANTS = [
  { name: "Checklist", Component: Checklist },
  { name: "Next step", Component: NextStep },
  { name: "Paper", Component: Paper },
];

export function Harness() {
  const params = useSearchParams();
  const role = (
    ["admin", "manager", "staff"].includes(params.get("role") ?? "")
      ? params.get("role")
      : "admin"
  ) as Role;
  const initial = Math.min(
    Math.max((Number(params.get("v")) || 1) - 1, 0),
    VARIANTS.length - 1,
  );
  const [current, setCurrent] = useState(initial);
  const [scenario, setScenario] = useState(
    SCENARIOS.find((s) => s.id === params.get("s"))?.id ?? "fresh",
  );
  const [state, setState] = useState<OrderState>(
    SCENARIOS.find((s) => s.id === scenario)!.state,
  );
  const [sending, setSending] = useState<DocRef | null>(null);
  const [previewing, setPreviewing] = useState<DocRef | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const isPhone = useIsPhone();

  const api: PanelApi = {
    state,
    role,
    isPhone,
    send: setSending,
    preview: setPreviewing,
    tellSupplier: (letter) => {
      setState((s) => markSupplierTold(s, letter));
      setToast("Marked as told");
    },
    complete: () => {
      setState((s) => ({ ...s, status: "completed" }));
      setToast("Order marked Completed");
    },
  };

  // Picker
  const [ready, setReady] = useState(false);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const moveHighlight = useCallback(() => {
    const el = itemRefs.current[current];
    const hl = highlightRef.current;
    if (!el || !hl) return;
    hl.style.width = `${el.offsetWidth}px`;
    hl.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [current]);
  useLayoutEffect(moveHighlight, [moveHighlight]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(current + 1));
    url.searchParams.set("s", scenario);
    window.history.replaceState(null, "", url);
  }, [current, scenario]);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true)),
    );
    window.addEventListener("resize", moveHighlight);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", moveHighlight);
    };
  }, [moveHighlight]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) setCurrent(num - 1);
      else if (e.key === "ArrowRight")
        setCurrent((c) => (c + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft")
        setCurrent((c) => (c - 1 + VARIANTS.length) % VARIANTS.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { Component } = VARIANTS[current];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 pb-24 md:gap-6 md:px-8 md:pt-8">
      {/* Prototype-only control: jump the order into different document states. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs text-ink-muted">
        <span className="font-medium">Prototype scenario:</span>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setScenario(s.id);
              setState(s.state);
            }}
            className={
              scenario === s.id
                ? "font-semibold text-navy underline underline-offset-4"
                : "hover:text-ink"
            }
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto">Role: {role}</span>
      </div>

      <OrderHeader
        state={state}
        role={role}
        onUnlock={() => setUnlocking(true)}
      />
      <Component key={current} api={api} />

      <SendDialog
        target={sending}
        state={state}
        isPhone={isPhone}
        onClose={() => setSending(null)}
        onConfirm={(ref, date, via) => {
          setState((s) => markSent(s, ref, date));
          setSending(null);
          setToast(
            via === "share"
              ? `${docNumber(ref)} shared`
              : `Downloaded ${docNumber(ref)}.pdf`,
          );
        }}
      />
      <PreviewDialog
        target={previewing}
        state={state}
        onClose={() => setPreviewing(null)}
      />
      <UnlockDialog
        open={unlocking}
        onClose={() => setUnlocking(false)}
        onUnlock={() => {
          setState(unlock);
          setUnlocking(false);
          setToast("Order unlocked");
        }}
      />
      <Toast message={toast} onDone={clearToast} />

      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        data-position="top"
        data-ready={ready ? "" : undefined}
      >
        <span
          ref={highlightRef}
          className="proto-picker-highlight"
          aria-hidden="true"
        />
        {VARIANTS.map((v, i) => (
          <button
            key={v.name}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => setCurrent(i)}
          >
            {v.name}
          </button>
        ))}
      </nav>
    </main>
  );
}
