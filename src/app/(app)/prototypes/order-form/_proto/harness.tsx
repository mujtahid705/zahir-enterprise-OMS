"use client";

// PROTOTYPE harness: one variant at a time, picker per the prototype skill's PICKER.md.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ledger } from "./ledger";
import { OrderPad } from "./order-pad";
import { Steps } from "./steps";
import type { Role } from "./shared";
import "./picker.css";

const VARIANTS = [
  { name: "Ledger", Component: Ledger },
  { name: "Steps", Component: Steps },
  { name: "Order pad", Component: OrderPad },
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
  const [ready, setReady] = useState(false);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveHighlight = () => {
    const el = itemRefs.current[current];
    const hl = highlightRef.current;
    if (!el || !hl) return;
    hl.style.width = `${el.offsetWidth}px`;
    hl.style.transform = `translateX(${el.offsetLeft}px)`;
  };

  useLayoutEffect(moveHighlight);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(current + 1));
    window.history.replaceState(null, "", url);
  }, [current]);

  useEffect(() => {
    // Enable the slide only after first paint, so load doesn't animate.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true)),
    );
    window.addEventListener("resize", moveHighlight);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", moveHighlight);
    };
  });

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
    <>
      <Component key={current} role={role} />
      <nav
        ref={pickerRef}
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
    </>
  );
}
