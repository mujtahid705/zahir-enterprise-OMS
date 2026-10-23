"use client";

// PROTOTYPE harness: one dashboard variant at a time. Picker per the prototype skill's PICKER.md.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Overview } from "./overview";
import { Pipeline } from "./pipeline";
import type { Role } from "./shared";
import { Todo } from "./todo";
import "./picker.css";

const VARIANTS = [
  { name: "Overview", Component: Overview },
  { name: "To-do", Component: Todo },
  { name: "Pipeline", Component: Pipeline },
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
    window.history.replaceState(null, "", url);
  }, [current]);
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
    <main className="flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8">
      <Component key={current} role={role} />
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
