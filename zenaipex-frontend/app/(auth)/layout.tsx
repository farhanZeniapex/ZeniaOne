"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, AudioLines, LockKeyhole, MessageCircle, PhoneCall, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import styles from "./auth.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const isSignup = usePathname() === "/signup";

  return (
    <div className={styles.page}>
      <div className={styles.pageGlow} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="ZeniaOne home">
            <BrandLogo iconSize={38} />
          </Link>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} strokeWidth={1.8} /> Back to website
          </Link>
        </header>

        <main className={styles.main}>
          <section className={styles.showcase} aria-label="ZeniaOne conversation experience">
            <div className={styles.showcaseGrid} aria-hidden="true" />
            <div className={styles.showcaseTop}>
              <span className={styles.eyebrow}><Sparkles size={14} /> ONE INTELLIGENCE. EVERY CHANNEL.</span>
              <span className={styles.edition}>Z · 1 / EXPERIENCE</span>
            </div>

            <div className={styles.showcaseCopy}>
              <h1>{isSignup ? <>Start with one agent.<br /><em>Go everywhere.</em></> : <>Welcome back to<br /><em>every conversation.</em></>}</h1>
              <p>{isSignup
                ? "Create your workspace, shape your agent, and meet your customers across chat, live voice, and calls."
                : "Your conversations, knowledge, and AI agent are ready when you are."}</p>
            </div>

            <div className={styles.visual} aria-hidden="true">
              <div className={styles.aura} />
              <div className={`${styles.orbit} ${styles.orbitOne}`} />
              <div className={`${styles.orbit} ${styles.orbitTwo}`} />
              <div className={`${styles.orbit} ${styles.orbitThree}`} />
              <div className={styles.sphere}><div className={styles.sphereHighlight} /><div className={styles.sphereArc} /></div>
              <span className={`${styles.channelTag} ${styles.chatTag}`}><MessageCircle size={15} /> CHAT</span>
              <span className={`${styles.channelTag} ${styles.voiceTag}`}><AudioLines size={15} /> LIVE VOICE</span>
              <span className={`${styles.channelTag} ${styles.callTag}`}><PhoneCall size={15} /> PHONE CALLS</span>
              <span className={styles.sparkOne} /><span className={styles.sparkTwo} />
            </div>

            <div className={styles.showcaseBottom}>
              <span className={styles.signal}><i /><i /><i /><i /><i /></span>
              <span>One agent. A more human connection.</span>
              <span className={styles.showcaseNumber}>01 / 03</span>
            </div>
          </section>

          <section className={styles.formSide} aria-label={isSignup ? "Create your account" : "Sign in to your account"}>
            <div className={styles.formTopline}>
              <span>{isSignup ? "YOUR WORKSPACE STARTS HERE" : "YOUR WORKSPACE IS READY"}</span>
              <span className={styles.secureLabel}><LockKeyhole size={13} /> SECURE ACCESS</span>
            </div>
            <div className={styles.formContent}>{children}</div>
            <div className={styles.formFooter}>
              <span>© 2026 ZeniaOne</span>
              <div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
