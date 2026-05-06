"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
// LEGACY: cosmic theme replaced by Excalidraw paper aesthetic
// import { MosaicBackground } from "@/components/ui/mosaic-background";
// import { ShardField } from "@/components/ui/glass-shard";
import { GlassCard } from "@/components/ui/glass-card";

function extractArxivId(inputRaw: string): string | null {
  const input = inputRaw.trim();
  if (!input) return null;

  const directNew = input.match(/^\d{4}\.\d{4,5}(v\d+)?$/i);
  if (directNew) return directNew[0];

  const directOld = input.match(/^[a-z-]+(\.[a-z]{2})?\/\d{7}(v\d+)?$/i);
  if (directOld) return directOld[0];

  const urlAbs = input.match(/arxiv\.org\/abs\/([^?\s#]+)/i);
  if (urlAbs?.[1]) return decodeURIComponent(urlAbs[1]).replace(/\/$/, "");

  const urlPdf = input.match(/arxiv\.org\/pdf\/([^?\s#]+?)(?:\.pdf)?$/i);
  if (urlPdf?.[1]) return decodeURIComponent(urlPdf[1]).replace(/\/$/, "");

  return null;
}

const placeholders = [
  "Paste an arXiv URL or ID...",
  "1706.03762 (Attention Is All You Need)",
  "https://arxiv.org/abs/2005.14165",
  "2303.08774 (GPT-4 Technical Report)",
  "1810.04805 (BERT)",
];

export default function Home() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const parsedId = useMemo(() => extractArxivId(value), [value]);
  const canSubmit = Boolean(parsedId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!parsedId) return;
    router.push(`/abs/${encodeURIComponent(parsedId)}`);
  }

  return (
    <main className="min-h-dvh relative overflow-hidden bg-[var(--paper-cream)]">
      {/* LEGACY: cosmic background removed — paper-cream bg applied instead */}
      {false && null /* MosaicBackground + ShardField bypassed */}

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        {/* ── First viewport: Hero heading + search bar ── */}
        <section className="min-h-dvh flex flex-col">
          {/* Spacer — keeps the heading area clear */}
          <div className="flex-1" />

          {/* Search area — pinned to lower portion of viewport */}
          <div className="max-w-4xl mx-auto w-full text-center pb-16 sm:pb-24">
            {/* Hero heading in hand-drawn font */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl sm:text-5xl font-bold text-[var(--ink-black)] font-[family-name:var(--font-handdrawn)] mb-4"
            >
              Feynman &amp; Friends
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-lg sm:text-xl text-[var(--ink-soft)] max-w-2xl mx-auto leading-relaxed font-light"
            >
              Paste any paper. Watch as Feynman, a Skeptic, and a Newbie
              teach it through <span className="text-[var(--ink-black)] font-medium marker-highlight">animation</span>.
            </motion.p>

            {/* Input Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-10 max-w-xl mx-auto"
            >
              <div className="relative">
                <PlaceholdersAndVanishInput
                  placeholders={placeholders}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setTouched(true);
                  }}
                  onSubmit={onSubmit}
                  disabled={!canSubmit && touched && value.length > 0}
                />
              </div>

              {/* Status feedback */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="mt-4 h-6 text-sm bg-[var(--paper-cream)]"
              >
                {parsedId ? (
                  <span className="text-[var(--accent-teal)] flex items-center justify-center gap-2">
                    <span className="text-lg">✓</span>
                    <span>Detected:{" "}</span>
                    <span className="font-mono bg-[var(--highlight-yellow)] px-2 py-0.5 rounded text-[var(--ink-black)]">{parsedId}</span>
                  </span>
                ) : touched && value ? (
                  <span className="text-[var(--accent-coral)]">
                    Enter a valid arXiv URL or paper ID
                  </span>
                ) : null}
              </motion.div>
            </motion.div>

            {/* Quick Examples */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <span className="text-sm text-[var(--ink-muted)]">Try these:</span>
              {[
                { id: "1706.03762", label: "Attention Is All You Need", icon: "◇" },
                { id: "2005.14165", label: "Language Models are Few-Shot Learners", icon: "◈" },
                { id: "2303.08774", label: "GPT-4 Technical Report", icon: "◆" },
              ].map((example) => (
                <motion.button
                  key={example.id}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/abs/${example.id}`)}
                  className="group rounded-xl bg-[var(--paper-cream-deep)] px-4 py-2.5 text-sm border-2 border-[var(--ink-black)] shadow-[2px_2px_0_0_var(--ink-black)] transition-all hover:shadow-[1px_1px_0_0_var(--ink-black)] hover:translate-x-[1px] hover:translate-y-[1px]"
                  style={{ borderRadius: "10px 14px 12px 13px / 13px 11px 14px 11px" }}
                >
                  <span className="text-[var(--ink-muted)] mr-2">{example.icon}</span>
                  <span className="text-[var(--ink-black)] font-mono">{example.id}</span>
                  <span className="text-[var(--ink-soft)] ml-2">({example.label})</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Pro Tip Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 2.2 }}
          className="mt-20 max-w-2xl mx-auto"
        >
          <GlassCard spotlight className="p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-xl bg-[var(--paper-cream-deep)] flex items-center justify-center border-2 border-[var(--pencil-gray)]">
                <div
                  className="h-4 w-4 bg-gradient-to-br from-[var(--accent-coral)] to-[var(--highlight-yellow)]"
                  style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
                />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--ink-black)] font-[family-name:var(--font-handdrawn)] text-lg">Pro Tip</h3>
                <p className="text-sm text-[var(--ink-soft)]">Three voices. One animation. Interrupt them anytime.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-[var(--ink-muted)] leading-relaxed">
              <p>
                Paste any arXiv ID (e.g.{" "}
                <code className="text-[var(--ink-black)] bg-[var(--paper-cream-deep)] px-1.5 py-0.5 rounded text-xs font-mono border border-[var(--pencil-gray)]">
                  1706.03762
                </code>
                ) or a full URL like{" "}
                <code className="text-[var(--ink-black)] bg-[var(--paper-cream-deep)] px-1.5 py-0.5 rounded text-xs font-mono border border-[var(--pencil-gray)]">
                  arxiv.org/abs/1706.03762
                </code>
                .
              </p>
              <p>
                The pipeline parses sections, drafts Manim animations, and three voice
                personas (Feynman / Skeptic / Newbie) teach you the paper.
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </main>
  );
}
