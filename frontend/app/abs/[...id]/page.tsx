"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CardStack } from "@/components/CardStack";
import type { ScrollySectionModel } from "@/components/ScrollySection";
import { GlassCard } from "@/components/ui/glass-card";
// LEGACY: cosmic theme replaced by Excalidraw paper aesthetic
// import { MosaicBackground } from "@/components/ui/mosaic-background";
// import { ShardField } from "@/components/ui/glass-shard";
import type { Paper, ProcessingStatus } from "@/lib/types";
import { DEMO_PAPER_IDS, getDemoPaper } from "@/lib/mock-data";
import {
  getPaper,
  processArxivPaper,
  getProcessingStatus,
  toProcessingStatus,
} from "@/lib/api";

// --- Demo simulation config ---
const DEMO_DURATION_MS = 5000;
const DEMO_TICK_MS = 50;
const DEMO_STEPS = [
  { label: "Fetching paper from arXiv", at: 0 },
  { label: "Parsing sections and equations", at: 0.2 },
  { label: "Analyzing concepts for visualization", at: 0.4 },
  { label: "Generating animations", at: 0.6 },
  { label: "Rendering videos", at: 0.8 },
];

function normalizeArxivId(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "";
  const joined = segments.join("/");
  try {
    return decodeURIComponent(joined);
  } catch {
    return joined;
  }
}

type PageState =
  | { type: "loading" }
  | { type: "not_found"; arxivId: string }
  | { type: "processing"; status: ProcessingStatus }
  | { type: "ready"; paper: Paper }
  | { type: "error"; message: string };

function clampLevel(level: number): 1 | 2 | 3 {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  return 3;
}

export default function PaperPage({
  params,
}: {
  params: Promise<{ id?: string[] }>;
}) {
  const resolvedParams = use(params);
  const arxivId = normalizeArxivId(resolvedParams.id);
  const absUrl = arxivId ? `https://arxiv.org/abs/${arxivId}` : "https://arxiv.org";
  const pdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : "https://arxiv.org";

  const [state, setState] = useState<PageState>({ type: "loading" });
  const [jobId, setJobId] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);
  const demoSimRunning = useRef(false);

  // Staged entrance:
  // 0.0s–0.7s  → paper-cream bg (no cosmic animation)
  // 0.7s       → UI fades in
  // 2.2s       → full UI ready, loadPaper fires
  const [bgVisible, setBgVisible] = useState(false);
  const [bgReady, setBgReady] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setBgVisible(true), 700);
    const t2 = setTimeout(() => setBgReady(true), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Shift+F fallback hotkey — persisted across refreshes via sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("ptFallback") === "1") {
      setFallbackMode(true);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "F" || e.key === "f")) {
        setFallbackMode((prev) => {
          const next = !prev;
          if (typeof window !== "undefined") {
            sessionStorage.setItem("ptFallback", next ? "1" : "0");
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadPaper = useCallback(async () => {
    if (!arxivId) {
      setState({ type: "error", message: "No arXiv ID provided" });
      return;
    }

    // Fallback mode: skip live API entirely, read from mock
    if (fallbackMode) {
      const demo = getDemoPaper(arxivId);
      if (demo) {
        setState({ type: "ready", paper: demo });
        return;
      }
      setState({ type: "not_found", arxivId });
      return;
    }

    // Demo paper: run simulated 5-second processing (for non-fallback mode)
    if (DEMO_PAPER_IDS.has(arxivId)) {
      const demoData = getDemoPaper(arxivId);
      const sectionCount = demoData?.sections.length ?? 5;
      demoSimRunning.current = true;
      setState({
        type: "processing",
        status: {
          job_id: "demo",
          status: "processing",
          progress: 0,
          sections_completed: 0,
          sections_total: sectionCount,
          current_step: DEMO_STEPS[0].label,
        },
      });
      return;
    }

    // Live API with 8-second auto-fallback timeout
    try {
      const paper = await Promise.race([
        getPaper(arxivId),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("API timeout (8s)")), 8000)
        ),
      ]);
      if (paper) {
        setState({ type: "ready", paper });
        return;
      }
      setState({ type: "not_found", arxivId });
    } catch (err) {
      // Auto-fallback: if API stalls or fails, try mock data silently
      const demo = getDemoPaper(arxivId);
      if (demo) {
        console.warn("Live API failed, falling back to mock:", err);
        setState({ type: "ready", paper: demo });
        return;
      }
      console.error("Error loading paper:", err);
      setState({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load paper",
      });
    }
  }, [arxivId, fallbackMode]);

  const startProcessing = useCallback(async () => {
    if (!arxivId) return;

    try {
      const response = await processArxivPaper(arxivId);
      setJobId(response.job_id);
      setState({
        type: "processing",
        status: {
          job_id: response.job_id,
          status: response.status,
          progress: 0,
          sections_completed: 0,
          sections_total: 0,
          current_step: "Starting...",
        },
      });
    } catch (err) {
      console.error("Error starting processing:", err);
      setState({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to start processing",
      });
    }
  }, [arxivId]);

  // Demo simulation: animate progress 0→100% over 5 seconds
  useEffect(() => {
    if (state.type !== "processing" || !demoSimRunning.current) return;

    const totalSections = state.status.sections_total;
    const startTime = Date.now();
    const timer = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / DEMO_DURATION_MS, 1);

      // Find current step label
      let currentStep = DEMO_STEPS[0].label;
      for (const step of DEMO_STEPS) {
        if (progress >= step.at) currentStep = step.label;
      }

      if (progress >= 1) {
        clearInterval(timer);
        // Show 100% with all steps "Done" for 800ms before transitioning
        setState({
          type: "processing",
          status: {
            job_id: "demo",
            status: "processing",
            progress: 1,
            sections_completed: totalSections,
            sections_total: totalSections,
            current_step: "Complete",
          },
        });
        setTimeout(async () => {
          demoSimRunning.current = false;
          const paper = await getPaper(arxivId);
          if (paper) {
            setState({ type: "ready", paper });
          }
        }, 800);
        return;
      }

      setState({
        type: "processing",
        status: {
          job_id: "demo",
          status: "processing",
          progress,
          sections_completed: Math.floor(progress * totalSections),
          sections_total: totalSections,
          current_step: currentStep,
        },
      });
    }, DEMO_TICK_MS);

    return () => {
      clearInterval(timer);
      demoSimRunning.current = false;
    };
  }, [state.type, arxivId]);

  // Real API polling (non-demo papers)
  useEffect(() => {
    if (state.type !== "processing" || !jobId || demoSimRunning.current) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await getProcessingStatus(jobId);
        const status = toProcessingStatus(response);

        if (response.status === "completed") {
          clearInterval(pollInterval);
          const paper = await getPaper(arxivId);
          if (paper) {
            setState({ type: "ready", paper });
          } else {
            setState({ type: "error", message: "Paper processing completed but paper not found" });
          }
        } else if (response.status === "failed") {
          clearInterval(pollInterval);
          setState({
            type: "error",
            message: response.error || "Processing failed",
          });
        } else {
          setState({ type: "processing", status });
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [state.type, jobId, arxivId]);

  // Don't start loading until the background has had its moment
  useEffect(() => {
    if (bgReady) loadPaper();
  }, [bgReady, loadPaper]);

  // Refetch when paper has sections but no videos (rendering may have just finished)
  const hasSectionsWithoutVideos =
    state.type === "ready" &&
    state.paper.sections.some((s) => !s.video_url);
  useEffect(() => {
    if (!hasSectionsWithoutVideos || !arxivId) return;
    let retries = 0;
    const maxRetries = 12; // ~2 min
    const refetchInterval = setInterval(async () => {
      retries++;
      if (retries > maxRetries) return clearInterval(refetchInterval);
      const paper = await getPaper(arxivId);
      if (paper && paper.sections.some((s) => s.video_url)) {
        setState({ type: "ready", paper });
        clearInterval(refetchInterval);
      }
    }, 10000);
    return () => clearInterval(refetchInterval);
  }, [hasSectionsWithoutVideos, arxivId]);

  const onProgressChange = useCallback((progress: number) => {
    setScrollProgress(progress);
  }, []);

  // Suppress unused var warning — pdfUrl kept for potential future use
  void pdfUrl;

  return (
    <main className="min-h-dvh relative bg-[var(--paper-cream)]">
      {/* LEGACY: cosmic background (MosaicBackground + ShardField) removed.
          Paper-cream bg is set via CSS variable on body + main. */}
      {false && null /* bgVisible guard preserved for staged entrance timing */}

      {/* Fallback mode indicator — visible only when Shift+F toggled */}
      {fallbackMode && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-1.5 border-2 border-[var(--ink-black)] bg-[var(--paper-cream-deep)] text-xs text-[var(--accent-coral)] font-[family-name:var(--font-handdrawn)] shadow-[2px_2px_0_0_var(--ink-black)]" style={{ borderRadius: "8px 12px 10px 11px / 11px 9px 12px 9px" }}>
          fallback: ON
        </div>
      )}

      {/* Foreground UI — fades in 2.2s after page loads */}
      <AnimatePresence>
        {bgReady && (
          <motion.div
            key="foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative z-10"
          >
            {/* Minimal progress bar — fixed at top, ink coral color */}
            {state.type === "ready" && (
              <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[var(--pencil-gray)]/30">
                <motion.div
                  className="h-full bg-[var(--accent-coral)]"
                  animate={{ width: `${scrollProgress * 100}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            )}

            {/* Floating back button — paper aesthetic */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="fixed top-5 left-5 z-50"
            >
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-full bg-[var(--paper-cream-deep)] px-4 py-2.5 text-sm text-[var(--ink-black)] border-2 border-[var(--ink-black)] shadow-[2px_2px_0_0_var(--ink-black)] transition-all hover:shadow-[1px_1px_0_0_var(--ink-black)] hover:translate-x-[1px] hover:translate-y-[1px]"
                style={{ borderRadius: "10px 14px 12px 13px / 13px 11px 14px 11px" }}
              >
                <span className="transition-transform group-hover:-translate-x-0.5">&larr;</span>
                <span className="hidden sm:inline">Back</span>
              </Link>
            </motion.div>

            {/* Content based on state */}
            <div className="min-h-dvh">
              {state.type === "loading" && <LoadingState message="Loading paper..." />}

              {state.type === "not_found" && (
                <NotFoundState arxivId={state.arxivId} onProcess={startProcessing} />
              )}

              {state.type === "processing" && <ProcessingState status={state.status} />}

              {state.type === "error" && (
                <ErrorState message={state.message} onRetry={loadPaper} />
              )}

              {state.type === "ready" && (
                <ReadyState
                  paper={state.paper}
                  absUrl={absUrl}
                  onProgressChange={onProgressChange}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// === Scrollytelling Ready State ===
function ReadyState({
  paper,
  absUrl,
  onProgressChange,
}: {
  paper: Paper;
  absUrl: string;
  onProgressChange: (progress: number) => void;
}) {
  const scrollySections: ScrollySectionModel[] = [...paper.sections]
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => ({
      id: s.id,
      title: s.title,
      content: s.summary || s.content,
      level: clampLevel(s.level),
      equations: s.equations,
      videoUrl: s.video_url,
    }));

  const heroContent = (
    <div className="mb-12">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6 pt-8 pb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--paper-cream-deep)] border-2 border-[var(--pencil-gray)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-coral)]" />
          <span className="text-sm text-[var(--ink-soft)]">Research Paper</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-[var(--ink-black)] leading-tight tracking-tight font-[family-name:var(--font-handdrawn)]">
          {paper.title}
        </h1>

        <p className="text-[var(--ink-muted)] max-w-2xl">
          {paper.authors.slice(0, 5).join(", ")}
          {paper.authors.length > 5 && ", et al."}
        </p>
      </motion.div>

      {/* Abstract */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="rounded-[12px_18px_14px_16px/16px_12px_18px_14px] bg-[var(--paper-cream-deep)] p-6 sm:p-8 border-2 border-[var(--ink-black)] shadow-[3px_3px_0_0_var(--ink-black)]">
          <h2 className="text-2xl font-medium text-[var(--ink-black)] mb-4 font-[family-name:var(--font-handdrawn)]">
            Abstract
          </h2>
          <p className="text-[var(--ink-soft)] leading-relaxed text-base sm:text-lg">
            {paper.abstract}
          </p>
        </div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 flex flex-col items-center gap-2 text-[var(--ink-muted)]"
      >
        <span className="text-xs tracking-wider uppercase">Scroll to begin reading</span>
        <motion.svg
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </motion.svg>
      </motion.div>

      {/* Divider before sections */}
      <div className="mt-10 h-px bg-gradient-to-r from-transparent via-[var(--pencil-gray)] to-transparent" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="px-6 py-8"
    >
      <div className="max-w-6xl mx-auto">
        <CardStack
          sections={scrollySections}
          heroContent={heroContent}
          onProgressChange={onProgressChange}
        />

        {/* Footer links */}
        <div className="mt-8 mb-16 flex items-center justify-center gap-4 text-sm">
          <a
            href={absUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--ink-muted)] hover:text-[var(--ink-black)] transition-colors"
          >
            View on arXiv
          </a>
          <span className="w-1 h-1 rounded-full bg-[var(--pencil-gray)]" />
          <Link href="/" className="text-[var(--ink-muted)] hover:text-[var(--ink-black)] transition-colors">
            Explore another paper
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// === State Components ===

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <div className="h-16 w-16 rounded-full border-[3px] border-[var(--pencil-gray)]/40" />
        <div
          className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--accent-coral)] border-r-[var(--accent-coral)]"
          style={{ animationDuration: '1.2s' }}
        />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 text-[var(--ink-muted)]"
      >
        {message}
      </motion.p>
    </div>
  );
}

function NotFoundState({
  arxivId,
  onProcess,
}: {
  arxivId: string;
  onProcess: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-20 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mx-auto h-24 w-24 grid place-items-center"
          style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
        >
          <div className="w-full h-full bg-[var(--paper-cream-deep)] border-2 border-[var(--pencil-gray)] grid place-items-center">
            <span className="text-3xl text-[var(--ink-muted)]">&int;</span>
          </div>
        </motion.div>

        <div className="mt-8 rounded-[12px_18px_14px_16px/16px_12px_18px_14px] bg-[var(--paper-cream-deep)] border-2 border-[var(--ink-black)] p-6 sm:p-8 shadow-[3px_3px_0_0_var(--ink-black)]">
          <h2 className="text-2xl font-medium text-[var(--ink-black)] font-[family-name:var(--font-handdrawn)]">Paper Not Yet Processed</h2>
          <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">
            This paper (<span className="font-mono text-[var(--ink-black)] bg-[var(--highlight-yellow)] px-2 py-0.5 rounded">{arxivId}</span>) hasn&apos;t been visualized yet.
            We&apos;ll parse the content and generate animations for key concepts.
          </p>

          <div className="mt-8 space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onProcess}
              className="w-full sm:w-auto rounded-[10px_14px_12px_13px/13px_11px_14px_11px] bg-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/80 px-8 py-4 text-sm font-medium text-white border-2 border-[var(--ink-black)] shadow-[3px_3px_0_0_var(--ink-black)] transition-all hover:shadow-[1px_1px_0_0_var(--ink-black)] hover:translate-x-[1px] hover:translate-y-[1px]"
            >
              Start Processing
            </motion.button>

            <p className="text-xs text-[var(--ink-muted)]">
              This usually takes 3-5 minutes depending on paper length
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Rough estimated seconds per pipeline step (total ~4-5 min)
const STEP_TIME_ESTIMATES = [35, 50, 55, 90, 75]; // fetch, parse, analyze, generate, render

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return "almost done";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins > 0) return `~${mins}m ${secs}s`;
  return `~${secs}s`;
}

function ProcessingState({ status }: { status: ProcessingStatus }) {
  const progressPercent = Math.round(status.progress * 100);

  const steps = [
    { label: "Fetching paper from arXiv", threshold: 10, icon: "∫" },
    { label: "Parsing sections and content", threshold: 30, icon: "∂" },
    { label: "Analyzing concepts for visualization", threshold: 50, icon: "∇" },
    { label: "Generating animations", threshold: 70, icon: "λ" },
    { label: "Rendering videos", threshold: 90, icon: "∞" },
  ];

  // Compute estimated time left based on current step and progress
  let estimatedSecondsLeft = 0;
  if (progressPercent >= 100) {
    estimatedSecondsLeft = 0;
  } else {
    // Step ranges: 0-10, 10-30, 30-50, 50-70, 70-100
    const stepBoundaries = [0, 10, 30, 50, 70, 100];
    const currentStepIndex = stepBoundaries.findIndex(
      (_, i) =>
        i < stepBoundaries.length - 1 &&
        progressPercent >= stepBoundaries[i] &&
        progressPercent < stepBoundaries[i + 1]
    );
    const stepIdx = Math.max(0, Math.min(currentStepIndex, steps.length - 1));
    const stepStart = stepBoundaries[stepIdx];
    const stepEnd = stepBoundaries[stepIdx + 1];
    const progressInStep = (stepEnd - stepStart > 0)
      ? (progressPercent - stepStart) / (stepEnd - stepStart)
      : 0;
    const remainingInCurrentStep =
      STEP_TIME_ESTIMATES[stepIdx] * Math.max(0, 1 - progressInStep);
    const remainingFutureSteps = STEP_TIME_ESTIMATES.slice(stepIdx + 1).reduce(
      (a, b) => a + b,
      0
    );
    const baseSeconds = remainingInCurrentStep + remainingFutureSteps;
    // Per-job variance (±15%) so each paper gets a different estimate
    const jobHash = status.job_id.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    const variance = 0.85 + ((Math.abs(jobHash) % 31) / 31) * 0.3;
    estimatedSecondsLeft = Math.max(1, Math.round(baseSeconds * variance));
  }

  return (
    <div className="flex items-center justify-center py-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-2xl"
      >
        <GlassCard animate={false} className="p-8">
          {/* Header */}
          <div className="flex items-center gap-5">
            <div className="relative h-14 w-14 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[3px] border-[var(--pencil-gray)]/40" />
              <div
                className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--accent-coral)] border-r-[var(--accent-coral)]"
                style={{ animationDuration: '1.2s' }}
              />
            </div>
            <div>
              <h2 className="text-2xl font-medium text-[var(--ink-black)] font-[family-name:var(--font-handdrawn)]">Processing Paper</h2>
              <p className="mt-1 text-[var(--ink-muted)]">{status.current_step || "Preparing..."}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-[var(--ink-muted)]">Overall Progress</span>
              <span className="flex items-center gap-4">
                {progressPercent < 100 && status.job_id !== "demo" && (
                  <span className="text-[var(--ink-soft)] font-medium">{formatTimeLeft(estimatedSecondsLeft)} left</span>
                )}
                <span className="font-mono text-[var(--ink-black)] font-medium">{progressPercent}%</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-[var(--pencil-gray)]/30 overflow-hidden border border-[var(--pencil-gray)]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-coral)] to-[var(--highlight-yellow)]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Sections */}
          {status.sections_total > 0 && (
            <div className="mt-4 flex items-center gap-3 text-sm">
              <span className="text-[var(--ink-muted)]">Sections processed:</span>
              <span className="font-mono text-[var(--ink-black)] bg-[var(--highlight-yellow)] px-2 py-0.5 rounded">
                {status.sections_completed} / {status.sections_total}
              </span>
            </div>
          )}

          {/* Steps */}
          <div className="mt-8 rounded-[10px_14px_12px_13px/13px_11px_14px_11px] bg-[var(--paper-cream)] p-6 border-2 border-[var(--pencil-gray)]">
            <div className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-4">Pipeline Progress</div>
            <ol className="space-y-3">
              {steps.map((step, i) => {
                const isActive = progressPercent >= step.threshold;
                const isCurrent = progressPercent >= step.threshold && progressPercent < 100 && (i === steps.length - 1 || progressPercent < steps[i + 1].threshold);

                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <span className={`text-xl transition-all duration-300 ${isActive ? 'text-[var(--ink-black)]' : 'text-[var(--pencil-gray)]'}`}>
                      {step.icon}
                    </span>
                    <span className={`flex-1 text-sm transition-colors duration-300 ${isActive ? 'text-[var(--ink-soft)]' : 'text-[var(--pencil-gray)]'}`}>
                      {step.label}
                    </span>
                    {isCurrent && (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-coral)] animate-pulse" />
                        <span className="text-xs text-[var(--ink-muted)]">In progress</span>
                      </span>
                    )}
                    {isActive && !isCurrent && (
                      <span className="text-xs text-[var(--accent-teal)] font-medium">Done</span>
                    )}
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-20 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="mx-auto h-24 w-24 rounded-3xl bg-[var(--paper-cream-deep)] border-2 border-[var(--accent-coral)] grid place-items-center"
        >
          <span className="text-4xl text-[var(--accent-coral)]">!</span>
        </motion.div>

        <h2 className="mt-8 text-2xl font-medium text-[var(--accent-coral)] font-[family-name:var(--font-handdrawn)]">Something Went Wrong</h2>
        <p className="mt-4 text-[var(--ink-muted)] leading-relaxed">{message}</p>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRetry}
          className="mt-8 rounded-[10px_14px_12px_13px/13px_11px_14px_11px] bg-[var(--paper-cream-deep)] px-8 py-4 text-sm font-medium text-[var(--ink-black)] border-2 border-[var(--ink-black)] shadow-[2px_2px_0_0_var(--ink-black)] transition-all hover:shadow-[1px_1px_0_0_var(--ink-black)] hover:translate-x-[1px] hover:translate-y-[1px]"
        >
          Try Again
        </motion.button>
      </motion.div>
    </div>
  );
}
