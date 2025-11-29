"use client";

import { useEffect, useState } from "react";

type State = "idle" | "checking" | "valid" | "invalid";

export default function UsernameField({
  initial = "",
  onValid,
  className = "",
}: {
  initial?: string;
  onValid?: (u: string) => void;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<State>("idle");

  // debounce simple
  useEffect(() => {
    if (!value || value === initial) {
      setState("idle");
      return;
    }
    const id = setTimeout(async () => {
      setState("checking");
      try {
        const res = await fetch(`/api/profile/check-username?u=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data?.available) {
          setState("valid");
          onValid?.(value);
        } else {
          setState("invalid");
        }
      } catch {
        setState("invalid");
      }
    }, 300);
    return () => clearTimeout(id);
  }, [value, initial, onValid]);

  const border =
    state === "valid"
      ? "border-green-500 focus:ring-green-300"
      : state === "invalid"
      ? "border-red-500 focus:ring-red-300"
      : state === "checking"
      ? "border-yellow-500 focus:ring-yellow-300"
      : "border-zinc-300 focus:ring-zinc-300";

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-sm font-medium text-zinc-200">Pseudo</label>
      <div className="relative">
        <input
          className={`w-full rounded-md bg-zinc-900 text-zinc-100 px-3 py-2 outline-none border ${border}`}
          placeholder="Ton pseudo"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
          {state === "valid" && "✅"}
          {state === "invalid" && "❌"}
          {state === "checking" && "⏳"}
        </span>
      </div>
      {state === "checking" && <p className="text-xs text-yellow-400">Vérification…</p>}
      {state === "invalid" && <p className="text-xs text-red-400">Pseudo déjà pris.</p>}
    </div>
  );
}
