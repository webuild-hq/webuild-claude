"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copier le lien" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-sm underline hover:no-underline"
    >
      {copied ? "Copié" : label}
    </button>
  );
}
