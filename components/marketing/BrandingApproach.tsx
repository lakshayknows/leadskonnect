"use client";

import React, { useRef, useState } from "react";
import { motion, useInView } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

// Glitch block positions: [x%, y%, width px, height px]
const GLITCH_BLOCKS: [number, number, number, number][] = [
  [2, -3, 22, 22],
  [12, -5, 14, 10],
  [28, -2, 10, 10],
  [82, 22, 8, 8],
  [-4, 75, 16, 12],
  [8, 82, 10, 10],
  [-2, 88, 18, 16],
  [56, 82, 12, 14],
  [70, 90, 10, 10],
  [42, 94, 8, 6],
];

type Label = { text: string; angle: number };
const LABELS: Label[] = [
  { text: "websites", angle: 215 },
  { text: "brands", angle: 335 },
  { text: "ui/ux design", angle: 110 },
];

// polar → cartesian on the 100x100 viewBox, centered at (50,50)
function polar(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

export default function BrandingApproach() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section
      ref={ref}
      className="overflow-x-hidden bg-[#0f0f0f] text-white"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
        {/* Header */}
        <div className="mb-20 flex items-start gap-4">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: EASE }}
              className="text-[#6e6e6e] font-light leading-[1.18] tracking-[-0.01em]"
              style={{ fontSize: "clamp(2rem, 3.4vw, 2.6rem)" }}
            >
              Our Comprehensive
            </motion.h2>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="text-white font-light leading-[1.18] tracking-[-0.01em]"
              style={{ fontSize: "clamp(2rem, 3.4vw, 2.6rem)" }}
            >
              Branding Approach
            </motion.h2>
          </div>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
            aria-label="Expand"
            className="grid h-7 w-7 place-items-center border border-white/20 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" stroke="currentColor" strokeWidth="1.3">
              <line x1="6" y1="1" x2="6" y2="11" />
              <line x1="1" y1="6" x2="11" y2="6" />
            </svg>
          </motion.button>
        </div>

        {/* Content row */}
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-10">
          {/* Left */}
          <div className="flex min-w-0 flex-1 flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
            {/* Glitch portrait */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
              className="relative shrink-0"
              style={{ width: 250, height: 310 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.pexels.com/photos/3778212/pexels-photo-3778212.jpeg?auto=compress&cs=tinysrgb&w=600"
                alt="Creative director portrait"
                className="h-full w-full object-cover"
              />
              {GLITCH_BLOCKS.map(([x, y, w, h], idx) => (
                <motion.span
                  key={idx}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={inView ? { scale: 1, opacity: [0, 1, 0.9] } : {}}
                  transition={{ duration: 0.35, delay: 0.5 + idx * 0.05, ease: EASE }}
                  className="absolute bg-white"
                  style={{ left: `${x}%`, top: `${y}%`, width: w, height: h }}
                />
              ))}
            </motion.div>

            {/* Testimonial */}
            <div className="min-w-0 max-w-[420px]">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
                className="text-[#555]"
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "3.2rem",
                  lineHeight: 0.7,
                }}
                aria-hidden
              >
                &ldquo;
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
                className="font-normal leading-[1.58] text-white/90"
                style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.28rem)" }}
              >
                We kept seeing the same pattern &mdash; brands with potential lost between
                messy processes, scattered visuals, and forgettable websites. This studio
                exists to align it all into one clear, consistent story.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
                className="mt-10"
              >
                <div className="text-[1.15rem] font-medium tracking-[0.01em] text-white">
                  Alex West
                </div>
                <div className="mt-1 text-[0.85rem] tracking-wide text-[#6e6e6e]">
                  Founder &amp; Creative Director
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right: circle diagram */}
          <div className="flex w-full max-w-[360px] shrink-0 items-center justify-center self-center sm:max-w-[400px] lg:max-w-[440px]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
              className="relative"
              style={{ aspectRatio: "1 / 1", width: "100%" }}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                <circle
                  cx="50"
                  cy="50"
                  r="30"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.18"
                  opacity="0.45"
                />
                {LABELS.map((l) => {
                  const end = polar(l.angle, 36);
                  const active = hovered === l.text;
                  return (
                    <line
                      key={l.text}
                      x1="50"
                      y1="50"
                      x2={end.x}
                      y2={end.y}
                      stroke="white"
                      style={{
                        strokeWidth: active ? 0.6 : 0.18,
                        opacity: active ? 1 : 0.45,
                        transition: "all 0.3s ease",
                      }}
                    />
                  );
                })}
              </svg>
              {LABELS.map((l, idx) => {
                const pos = polar(l.angle, 46);
                const active = hovered === l.text;
                return (
                  <motion.div
                    key={l.text}
                    initial={{ opacity: 0, y: 16 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.7, delay: 0.6 + idx * 0.15, ease: EASE }}
                    onMouseEnter={() => setHovered(l.text)}
                    onMouseLeave={() => setHovered(null)}
                    className="absolute whitespace-nowrap text-white"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: "clamp(1.25rem, 2.8vw, 2.4rem)",
                      letterSpacing: "-0.01em",
                      fontWeight: active ? 700 : 300,
                      transition: "font-weight 0.25s ease",
                      cursor: "default",
                    }}
                  >
                    {l.text}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
