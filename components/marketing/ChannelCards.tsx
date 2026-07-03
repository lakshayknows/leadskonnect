"use client";

import React, { useEffect, useRef } from "react";
import { Mail, Linkedin, MessageCircle, MessagesSquare, Database, Bot } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Card = {
  icon: typeof Mail;
  title: string;
  color: string;
  metric: string;
  blurb: string;
};

const CARDS: Card[] = [
  { icon: Mail, title: "Email", color: "var(--color-ch-email)", metric: "40 / hour", blurb: "DKIM-signed, warmed up, and paced so you land in the inbox — not spam." },
  { icon: Linkedin, title: "LinkedIn", color: "var(--color-ch-linkedin)", metric: "~20 invites / day", blurb: "Humanized timing and gradual ramps that mimic real activity." },
  { icon: MessageCircle, title: "WhatsApp", color: "var(--color-ch-whatsapp)", metric: "250 / 24h", blurb: "Opt-in aware, template-approved, quality-rating safe." },
  { icon: MessagesSquare, title: "Social", color: "var(--color-ch-social)", metric: "on-brand", blurb: "Drop a comment where the conversation is already happening." },
  { icon: Database, title: "CRM", color: "var(--color-ink)", metric: "every touch", blurb: "Leads, stages, and each channel's activity in one timeline." },
  { icon: Bot, title: "AI Agent", color: "var(--color-brand)", metric: "claude-opus-4-8", blurb: "Runs the whole sequence for you — and never outruns a rate limit." },
];

export default function ChannelCards() {
  const section = useRef<HTMLDivElement>(null);
  const deck = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const active = useRef(0);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const N = CARDS.length;
    const smooth = (t: number) => t * t * (3 - 2 * t);

    const layout = () => {
      const spacing = Math.min(340, window.innerWidth * 0.42);
      for (let i = 0; i < N; i++) {
        const el = cardEls.current[i];
        if (!el) continue;
        const offset = i - active.current;
        const abs = Math.abs(offset);
        const sign = Math.sign(offset);
        if (abs > 3.2) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        const e = smooth(Math.min(abs, 1));
        const x = offset * spacing;
        const z = -abs * 170;
        const rotY = -sign * (e * 26 + Math.max(0, abs - 1) * 8) + mouse.current.x * 6;
        const rotX = -mouse.current.y * 6;
        const scale = 1 - Math.min(abs * 0.11, 0.5);
        el.style.opacity = String(abs > 2.6 ? 0 : 1 - Math.min(abs * 0.22, 0.7));
        el.style.pointerEvents = abs < 0.5 ? "auto" : "none";
        el.style.zIndex = String(100 - Math.round(abs * 10));
        el.style.transform = `translate(-50%,-50%) translateX(${x}px) translateZ(${z}px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${scale})`;
      }
    };

    const ctx = gsap.context(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const st = ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: () => `+=${(N - 1) * 420}`,
        pin: true,
        scrub: reduce ? false : 0.6,
        onUpdate: (self) => {
          active.current = self.progress * (N - 1);
          layout();
        },
      });

      // mouse tilt on the deck
      const onMove = (e: MouseEvent) => {
        const r = deck.current?.getBoundingClientRect();
        if (!r) return;
        mouse.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        mouse.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMove);

      const tick = () => {
        mouse.current.x += (mouse.current.tx - mouse.current.x) * 0.08;
        mouse.current.y += (mouse.current.ty - mouse.current.y) * 0.08;
        layout();
      };
      gsap.ticker.add(tick);

      layout();
      return () => {
        window.removeEventListener("mousemove", onMove);
        gsap.ticker.remove(tick);
        st.kill();
      };
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section id="channels" ref={section} className="relative h-screen overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] grid-dots" style={{ filter: "invert(1)" }} />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-6">
        <div className="mb-2 text-center">
          <span className="eyebrow !text-white/50">Every channel, one system</span>
          <h2 className="font-display mt-3 text-[clamp(2rem,4.5vw,3.2rem)] font-bold">
            Scroll through the <span className="gradient-text">stack</span>
          </h2>
        </div>

        {/* 3D deck */}
        <div
          ref={deck}
          className="relative mx-auto mt-6 h-[300px] w-full"
          style={{ perspective: "1300px" }}
        >
          <div className="absolute left-1/2 top-1/2 h-full w-full" style={{ transformStyle: "preserve-3d" }}>
            {CARDS.map((c, i) => (
              <div
                key={c.title}
                ref={(el) => { cardEls.current[i] = el; }}
                className="glass-dark absolute left-1/2 top-1/2 h-[280px] w-[240px] rounded-[22px] p-6 transition-shadow duration-300 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] sm:w-[260px]"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: c.color, color: c.title === "CRM" ? "#fff" : "#fff" }}
                >
                  <c.icon className="h-6 w-6" />
                </div>
                <div className="mt-6 font-mono text-xs uppercase tracking-widest" style={{ color: c.color }}>
                  {c.metric}
                </div>
                <h3 className="font-display mt-1 text-2xl font-bold">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{c.blurb}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-xs text-white/40">keep scrolling ↓</p>
      </div>
    </section>
  );
}
