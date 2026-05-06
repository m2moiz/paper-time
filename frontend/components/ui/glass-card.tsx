"use client";

import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  spotlight?: boolean;
  spotlightColor?: string;
  animate?: boolean;
  delay?: number;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  spotlight = true,
  spotlightColor = "rgba(255, 232, 158, 0.25)",
  animate = true,
  delay = 0,
  onClick,
}: GlassCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  }

  const spotlightBg = useMotionTemplate`
    radial-gradient(
      400px circle at ${mouseX}px ${mouseY}px,
      ${spotlightColor},
      transparent 60%
    )
  `;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 16 } : undefined}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={animate ? { duration: 0.5, delay, ease: "easeOut" } : undefined}
      onMouseMove={spotlight ? handleMouseMove : undefined}
      onClick={onClick}
      className={cn(
        "group relative rounded-[12px_18px_14px_16px/16px_12px_18px_14px]",
        "bg-[var(--paper-cream-deep)]",
        "border-2 border-[var(--ink-black)]",
        "shadow-[3px_3px_0_0_var(--ink-black)]",
        "transition-shadow duration-200",
        "hover:shadow-[1px_1px_0_0_var(--ink-black)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {spotlight && (
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[12px_18px_14px_16px/16px_12px_18px_14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: spotlightBg }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
