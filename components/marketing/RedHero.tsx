"use client";

import React from "react";
import { motion } from "motion/react";

/**
 * Red "S.P.D" manifesto hero. Solid #FF0000 blending into a bottom video.
 *
 * A11Y NOTE (see design_constraints.md §2): white on #FF0000 is ~4.0:1 — it passes
 * WCAG AA only for LARGE/bold text, and fails for normal body copy (needs 4.5:1).
 * The big logo + signature are fine. The mission/paragraph copy is therefore rendered
 * a touch larger + medium weight to stay legible; if you need strict AA on the small
 * copy, switch this section's small-text areas to the --brand-red-safe (#D10000) token.
 */

// The bottom video URL was truncated in the source spec — replace with the real asset.
const BOTTOM_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260613_180732_a54afbf6-b30d-470e-861f-669871f09f67.mp4";

export default function RedHero() {
  return (
    <section className="relative z-10 flex min-h-screen w-full flex-col bg-[#FF0000]">
      {/* Centered content */}
      <div className="flex w-full flex-1 flex-col items-center pt-[100px] md:pt-[240px]">
        <div className="relative z-20 mx-auto flex h-auto w-full max-w-[900px] flex-col items-center px-8 text-center">
          {/* Logo */}
          <motion.svg
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            width="80"
            height="80"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mb-12"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M60 120C26.8629 120 0 93.1371 0 60V0C22.5654 0 42.2213 12.4569 52.4662 30.8691C38.4788 34.2089 28.0787 46.7902 28.0787 61.8006V63.1443C28.0787 79.9648 41.7146 93.6006 58.5353 93.6006H59.8789L59.8785 61.8006C59.8785 79.3633 74.1159 93.6006 91.6787 93.6006L91.6787 61.8006C91.6787 44.2783 77.5071 30.0661 60 30.0008L60 0H62.5352C94.2722 0 120 25.7279 120 57.4648V60C120 93.1371 93.1371 120 60 120Z"
              fill="white"
            />
          </motion.svg>

          {/* Mission statement */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-[40px] h-[100px] w-full max-w-[400px] font-medium uppercase leading-[1.6] tracking-wider text-white"
            style={{ fontSize: "16px" }}
          >
            We built this platform with a single purpose to eliminate operational chaos and
            restore balance to your daily business routine
          </motion.p>

          {/* Signature */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mb-[32px] leading-none text-white"
            style={{ fontFamily: "'Marck Script', cursive", fontSize: "120px" }}
          >
            S.P.D
          </motion.div>

          {/* Two paragraphs */}
          <div className="mb-[100px] flex w-full flex-col items-center font-light leading-[1.6] text-white md:mb-24">
            <p className="mb-[24px] w-[400px] max-w-full text-center" style={{ fontSize: "16px" }}>
              I Was Exhausted By Software That Demanded More Effort Than It Actually Saved.
              That Is Why We Engineered An Autonomous Architecture That Operates Silently In
              The Background.
            </p>
            <p className="w-[400px] max-w-full text-center" style={{ fontSize: "16px" }}>
              Your Business Should Serve Your Life, Not Consume It. Let Our Algorithms Handle
              The Heavy Lifting, So You Can Focus On The Vision.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom video with red gradient blend */}
      <div className="relative w-full shrink-0">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-[100px] w-full bg-gradient-to-b from-[#FF0000] to-transparent" />
        <video
          src={BOTTOM_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          className="h-[60vh] w-full object-cover"
        />
      </div>
    </section>
  );
}
