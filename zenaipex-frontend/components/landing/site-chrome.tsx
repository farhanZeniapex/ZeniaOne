"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import styles from "./site-chrome.module.css";

const navigation = [
  { label: "Features", href: "#features", id: "features" },
  { label: "Architecture", href: "#architecture", id: "architecture" },
  { label: "Capabilities", href: "#capabilities", id: "capabilities" },
  { label: "Pricing", href: "#pricing", id: "pricing" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 12);
      let active = "";
      for (const item of navigation) {
        const section = document.getElementById(item.id);
        if (section && section.getBoundingClientRect().top <= 150) active = item.id;
      }
      setActiveSection(active);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
      <div className={styles.navShell}>
        <Link href="/" className={styles.brand} aria-label="ZeniaOne home" onClick={() => setMenuOpen(false)}>
          <BrandLogo iconSize={34} />
        </Link>

        <nav className={styles.desktopNav} aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.id} href={item.href} className={`${styles.navLink} ${activeSection === item.id ? styles.navLinkActive : ""}`} aria-current={activeSection === item.id ? "location" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.desktopActions}>
          <Link href="/login" className={styles.signIn}>Sign In</Link>
          <Link href="/signup" className={styles.startButton}>Get Started <ArrowUpRight size={16} /></Link>
        </div>

        <div className={styles.mobileActions}>
          <Link href="/login" className={styles.mobileSignIn}>Sign In</Link>
          <button type="button" className={styles.menuButton} aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-navigation" className={styles.mobileMenu} aria-label="Mobile navigation">
          <span className={styles.menuEyebrow}>EXPLORE ZENIAONE</span>
          {navigation.map((item, index) => (
            <Link key={item.id} href={item.href} className={`${styles.mobileLink} ${activeSection === item.id ? styles.mobileLinkActive : ""}`} aria-current={activeSection === item.id ? "location" : undefined} onClick={() => setMenuOpen(false)}>
              <span><small>0{index + 1}</small>{item.label}</span><ArrowUpRight size={17} />
            </Link>
          ))}
          <div className={styles.mobileMenuActions}>
            <Link href="#demo" onClick={() => setMenuOpen(false)}>Book a Demo</Link>
            <Link href="/signup" onClick={() => setMenuOpen(false)}>Get Started <ArrowRight size={16} /></Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGlow} aria-hidden="true" />
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div><span className={styles.footerKicker}>THE NEXT CONVERSATION STARTS HERE</span><h2>Make every interaction <em>count.</em></h2></div>
          <Link href="#demo" className={styles.footerCta}>Book a Demo <ArrowUpRight size={19} /></Link>
        </div>

        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <Link href="/" aria-label="ZeniaOne home"><BrandLogo iconSize={38} /></Link>
            <p>One AI agent for chat, live voice, and phone calls. Grounded in the knowledge that makes your business yours.</p>
            <div className={styles.footerChannels}><span>CHAT</span><i /><span>LIVE VOICE</span><i /><span>CALLS</span></div>
          </div>

          <nav className={styles.footerColumn} aria-label="Footer explore links">
            <h3>Explore</h3>
            {navigation.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}
          </nav>
          <nav className={styles.footerColumn} aria-label="Footer account links">
            <h3>Get started</h3>
            <Link href="#demo">Book a Demo</Link>
            <Link href="/signup">Create an Account</Link>
            <Link href="/login">Customer Portal</Link>
          </nav>
          <nav className={styles.footerColumn} aria-label="Footer legal links">
            <h3>Legal</h3>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/security">Security</Link>
          </nav>
        </div>

        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} ZeniaOne. All rights reserved.</span>
          <span>Built for better conversations.</span>
        </div>
      </div>
    </footer>
  );
}
