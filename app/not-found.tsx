"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Menu,
  X,
  Facebook,
  Twitter,
  Dribbble,
  Youtube,
  Linkedin,
  Instagram,
} from "lucide-react";

const BG_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260613_180732_a54afbf6-b30d-470e-861f-669871f09f67.mp4";

const NAV_LINKS = ["Domain", "Servers", "Cloud", "Managed", "Email", "Privacy"];

const FOOTER_COLUMNS: { title: string; links: string[] }[] = [
  { title: "SERVERS", links: ["Web Servers", "VPS Servers", "Cloud Servers", "Managed Instances", "Bare Metal"] },
  { title: "DOMAINS", links: ["Find Domain", "Move Domains", "DNS Manager", "Domain Costs"] },
  { title: "HELP US", links: ["Open a Ticket", "FAQs", "Docs", "Tutorials", "Forum"] },
  { title: "ABOUT", links: ["Our Story", "Leadership Team", "Press Room", "We Hire", "Alliance", "Blog"] },
];

const SOCIALS = [Facebook, Twitter, Dribbble, Youtube, Linkedin, Instagram];

export default function NotFound() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      const t = setTimeout(() => setMenuVisible(true), 10);
      return () => clearTimeout(t);
    }
  }, [mobileMenuOpen]);

  const openMenu = () => setMobileMenuOpen(true);
  const closeMenu = () => {
    setMenuVisible(false);
    setTimeout(() => setMobileMenuOpen(false), 500);
  };

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{ fontFamily: '"Helvetica Now Var", Helvetica, Arial, sans-serif' }}
    >
      {/* Background video */}
      <video
        src={BG_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-5 md:px-12 lg:px-16">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 480 480" className="h-8 w-8" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M480 240a240 240 0 0 0-240 240 240 240 0 0 0 240-240Z" />
              <path d="M240 0A240 240 0 0 0 0 240 240 240 0 0 0 240 0Z" />
              <path d="M480 240A240 240 0 0 0 240 0a240 240 0 0 0 240 240Z" />
              <path d="M240 480A240 240 0 0 0 0 240a240 240 0 0 0 240 240Z" />
            </svg>
            <span className="text-xl font-bold tracking-wider text-white">NEXOVA</span>
          </div>

          <div className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l}
                href="#"
                className="text-sm tracking-wide text-white/80 transition-colors duration-200 hover:text-white"
              >
                {l}
              </a>
            ))}
          </div>

          <a
            href="#"
            className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white lg:flex"
          >
            LOG IN <ArrowRight className="h-4 w-4" />
          </a>

          {/* Hamburger */}
          <button
            onClick={mobileMenuOpen ? closeMenu : openMenu}
            className="relative z-[60] lg:hidden"
            aria-label="Toggle menu"
          >
            <span className="relative block h-6 w-6">
              <Menu
                className={`absolute inset-0 h-6 w-6 text-white transition-all duration-300 ${
                  mobileMenuOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
                }`}
              />
              <X
                className={`absolute inset-0 h-6 w-6 text-white transition-all duration-300 ${
                  mobileMenuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
                }`}
              />
            </span>
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <>
            <div
              onClick={closeMenu}
              className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-md transition-opacity duration-[400ms] ${
                menuVisible ? "opacity-100" : "opacity-0"
              }`}
            />
            <div className="absolute left-0 right-0 top-[68px] z-50">
              <div className="absolute inset-0 rounded-b-2xl backdrop-blur-xl" />
              <div className="relative z-10 flex flex-col items-center gap-6 py-10">
                {NAV_LINKS.map((l, i) => (
                  <a
                    key={l}
                    href="#"
                    onClick={closeMenu}
                    className="text-lg font-light tracking-[0.08em] text-white/80 transition-all duration-[400ms] ease-out hover:text-white sm:text-xl"
                    style={{
                      opacity: menuVisible ? 1 : 0,
                      transform: menuVisible ? "translateY(0)" : "translateY(12px)",
                      transitionDelay: `${menuVisible ? 350 + i * 50 : 0}ms`,
                    }}
                  >
                    {l}
                  </a>
                ))}
                <a
                  href="#"
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-[400ms] ease-out"
                  style={{
                    opacity: menuVisible ? 1 : 0,
                    transform: menuVisible ? "translateY(0)" : "translateY(12px)",
                    transitionDelay: `${menuVisible ? 350 + NAV_LINKS.length * 50 : 0}ms`,
                  }}
                >
                  LOG IN <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </>
        )}

        {/* Hero */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16 md:py-0">
          <h1 className="mb-1 text-lg font-light leading-snug tracking-tight text-white/80 sm:mb-2 sm:text-3xl md:text-5xl">
            This page seems to have
          </h1>
          <h1 className="mb-8 text-lg font-light leading-snug tracking-tight text-white/80 sm:mb-12 sm:text-3xl md:text-5xl">
            slipped beyond our reach :/
          </h1>

          <div className="relative mb-8 flex w-full justify-center overflow-visible sm:mb-12">
            <span className="four-oh-four select-none text-[80px] font-black leading-none tracking-tighter text-white sm:text-[140px] md:text-[200px] lg:text-[260px]">
              404
            </span>
          </div>

          <a
            href="/"
            className="liquid-glass rounded-full px-6 py-3 text-[10px] font-medium uppercase tracking-[0.15em] text-white sm:px-8 sm:py-3.5 sm:text-sm sm:tracking-[0.2em]"
          >
            Return to Main Page
          </a>
        </div>

        {/* Footer */}
        <footer className="relative z-10 px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-16 md:px-12 lg:px-16">
          <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4 lg:grid-cols-6 lg:gap-6">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="mb-3 text-[10px] font-bold tracking-[0.15em] text-white sm:mb-4 sm:text-xs">
                  {col.title}
                </h3>
                <ul className="space-y-2 sm:space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-[10px] text-white/50 transition-colors duration-200 hover:text-white/80 sm:text-xs"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="col-span-2 lg:col-span-2">
              <h3 className="mb-3 text-[10px] font-bold tracking-[0.15em] text-white sm:mb-4 sm:text-xs">
                JOIN FOR EXCLUSIVE DEALS
              </h3>
              <div className="flex max-w-sm">
                <input
                  type="email"
                  placeholder="Type your email to sign up"
                  className="w-full rounded-l-md bg-white px-3 py-2 text-xs text-black outline-none"
                />
                <button className="rounded-r-md bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-xs font-bold tracking-wider text-white">
                  SEND IT
                </button>
              </div>
              <h3 className="mb-3 mt-5 text-[10px] font-bold tracking-[0.15em] text-white sm:mt-6 sm:text-xs">
                CONNECT
              </h3>
              <div className="flex gap-3">
                {SOCIALS.map((Icon, i) => (
                  <a key={i} href="#" className="text-white/50 transition-colors hover:text-white">
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
