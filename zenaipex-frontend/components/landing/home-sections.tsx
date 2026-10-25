import Link from "next/link";
import { ArrowRight, ArrowUpRight, AudioLines, BookOpen, CalendarCheck, Check, Globe2, Headphones, MessageCircle, PhoneCall, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import styles from "./home-sections.module.css";

const plans = [
  { name: "Starter", price: "$0", period: "/ month", summary: "For your first AI agent.", features: ["1 AI agent", "500 conversation minutes", "Web chat widget", "English support"], action: "Get started free", href: "/signup" },
  { name: "Growth", price: "$149", period: "/ month", summary: "For conversations at scale.", features: ["Up to 5 AI agents", "5,000 conversation minutes", "Phone and web channels", "Multilingual support"], action: "Start free trial", href: "/signup", featured: true },
  { name: "Enterprise", price: "Custom", period: "", summary: "For teams with bigger ambitions.", features: ["Unlimited agents", "Dedicated infrastructure", "Custom voice personas", "Priority support"], action: "View full details", href: "/pricing" },
];

export function HomeSections() {
  return (
    <>
      <section id="features" className={`${styles.section} ${styles.channels}`} aria-labelledby="channels-title">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.kicker}><span className={styles.kickerLine} /> 02 / THE EXPERIENCE</span>
            <h2 id="channels-title">One agent. <em>Three ways to connect.</em></h2>
            <p>From a quick message to a real conversation, your agent meets customers where they are.</p>
          </div>
          <div className={styles.channelCards}>
            <article className={`${styles.channelCard} ${styles.chatCard}`}>
              <div className={styles.cardTop}><span className={styles.cardNumber}>01</span><span className={styles.cardIcon}><MessageCircle size={19} /></span></div>
              <div className={styles.chatVisual} aria-hidden="true">
                <div className={styles.chatHeader}><span className={styles.avatar}>Z</span><span><strong>ZeniaOne Agent</strong><small><i /> Online now</small></span></div>
                <div className={styles.customerBubble}>Can you help me choose a plan?</div>
                <div className={styles.agentBubble}>Of course. Tell me what your team needs.</div>
                <div className={styles.typingBubble}><i /><i /><i /></div>
              </div>
              <div className={styles.cardCopy}><span>WEB CHAT</span><h3>Answers that feel personal.</h3><p>Instant, grounded replies wherever customers type.</p></div>
            </article>
            <article className={`${styles.channelCard} ${styles.voiceCard}`}>
              <div className={styles.cardTop}><span className={styles.cardNumber}>02</span><span className={styles.cardIcon}><AudioLines size={20} /></span></div>
              <div className={styles.voiceVisual} aria-hidden="true"><div className={styles.voiceHalo} /><div className={styles.voiceOrb} /><div className={styles.voiceWave}>{Array.from({ length: 17 }, (_, i) => <i key={i} />)}</div><span className={styles.voiceLabel}><i /> LIVE SESSION</span></div>
              <div className={styles.cardCopy}><span>LIVE VOICE</span><h3>Speak. Pause. Keep going.</h3><p>Natural voice conversations with room to respond.</p></div>
            </article>
            <article className={`${styles.channelCard} ${styles.callsCard}`}>
              <div className={styles.cardTop}><span className={styles.cardNumber}>03</span><span className={styles.cardIcon}><PhoneCall size={19} /></span></div>
              <div className={styles.callVisual} aria-hidden="true">
                <span className={styles.callRings} /><span className={styles.callAvatar}><PhoneCall size={25} /></span>
                <strong>Incoming call</strong><small>ZeniaOne is ready to answer</small>
                <span className={styles.answerPill}>AI AGENT ACTIVE <i /></span>
              </div>
              <div className={styles.cardCopy}><span>PHONE CALLS</span><h3>Be there for every caller.</h3><p>Helpful conversations from the first hello.</p></div>
            </article>
          </div>
        </div>
      </section>

      <section id="architecture" className={`${styles.section} ${styles.intelligence}`} aria-labelledby="intelligence-title">
        <div className={styles.intelligenceGrid} aria-hidden="true" />
        <div className={`${styles.container} ${styles.intelligenceLayout}`}>
          <div className={styles.intelligenceCopy}>
            <span className={`${styles.kicker} ${styles.kickerLight}`}><span className={styles.kickerLine} /> 03 / CONNECTED INTELLIGENCE</span>
            <h2 id="intelligence-title">One brain behind <em>every interaction.</em></h2>
            <p>Give your agent the context it needs. The same knowledge and personality travel across chat, live voice, and calls.</p>
            <div className={styles.processList}>
              <div><span>01</span><strong>Connect your knowledge</strong><small>Bring in the information your business trusts.</small></div>
              <div><span>02</span><strong>Shape your agent</strong><small>Choose how it should respond and sound.</small></div>
              <div><span>03</span><strong>Go live everywhere</strong><small>One consistent experience across channels.</small></div>
            </div>
          </div>
          <div className={styles.networkVisual} aria-label="Business knowledge and agent personality connect to chat, voice, and calls">
            <div className={styles.networkRing} aria-hidden="true" />
            <div className={styles.networkRingTwo} aria-hidden="true" />
            <div className={styles.networkCore}><span className={styles.networkCoreGlow} /><Sparkles size={27} /><strong>ZENIA<span>ONE</span></strong><small>YOUR AI AGENT</small></div>
            <div className={`${styles.networkNode} ${styles.nodeKnowledge}`}><BookOpen size={18} /><span>Knowledge</span></div>
            <div className={`${styles.networkNode} ${styles.nodePersona}`}><Headphones size={18} /><span>Your voice</span></div>
            <div className={`${styles.networkNode} ${styles.nodeChat}`}><MessageCircle size={17} /><span>Chat</span></div>
            <div className={`${styles.networkNode} ${styles.nodeVoice}`}><AudioLines size={18} /><span>Live voice</span></div>
            <div className={`${styles.networkNode} ${styles.nodeCalls}`}><PhoneCall size={17} /><span>Calls</span></div>
            <span className={styles.networkCaption}>ONE CONNECTED CONVERSATION LAYER</span>
          </div>
        </div>
      </section>

      <section id="capabilities" className={`${styles.section} ${styles.capabilities}`} aria-labelledby="capabilities-title">
        <div className={styles.container}>
          <div className={styles.capabilitiesHead}>
            <div><span className={styles.kicker}><span className={styles.kickerLine} /> 04 / WHAT IT CAN DO</span><h2 id="capabilities-title">Built to do more <em>than answer.</em></h2></div>
            <p>Useful intelligence for the moments that move your business forward.</p>
          </div>
          <div className={styles.capabilityGrid}>
            <article className={`${styles.capabilityCard} ${styles.capabilityFeature}`}><span className={styles.capabilityIcon}><BookOpen size={24} /></span><div className={styles.documentVisual} aria-hidden="true"><span /><span /><span /><i><Sparkles size={22} /></i></div><h3>Knows your business.</h3><p>Answers grounded in the knowledge you provide.</p></article>
            <article className={styles.capabilityCard}><span className={styles.capabilityIcon}><Globe2 size={24} /></span><span className={styles.capabilityAccent}>EN · HI · GU</span><h3>Speaks their language.</h3><p>Conversations that feel natural across languages.</p></article>
            <article className={styles.capabilityCard}><span className={styles.capabilityIcon}><CalendarCheck size={24} /></span><span className={styles.capabilityAccent}><Workflow size={31} /></span><h3>Gets things moving.</h3><p>Capture leads, book time, and connect workflows.</p></article>
            <article className={styles.capabilityCard}><span className={styles.capabilityIcon}><ShieldCheck size={24} /></span><span className={styles.capabilityAccent}>PRIVATE BY DESIGN</span><h3>Built for trust.</h3><p>Keep your business context within its own workspace.</p></article>
          </div>
        </div>
      </section>

      <section id="pricing" className={`${styles.section} ${styles.pricing}`} aria-labelledby="pricing-title">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.kicker}><span className={styles.kickerLine} /> 05 / SIMPLE PRICING</span>
            <h2 id="pricing-title">Start simple. <em>Grow naturally.</em></h2>
            <p>Choose the space your conversations need today.</p>
          </div>
          <div className={styles.pricingGrid}>
            {plans.map((plan) => (
              <article key={plan.name} className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ""}`}>
                {plan.featured && <span className={styles.popular}>MOST POPULAR</span>}
                <div className={styles.planHead}><span>{plan.name}</span><Sparkles size={18} /></div>
                <p className={styles.planSummary}>{plan.summary}</p>
                <div className={styles.planPrice}>{plan.price}<small>{plan.period}</small></div>
                <div className={styles.planRule} />
                <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
                <Link href={plan.href} className={styles.planAction}>{plan.action}<ArrowRight size={17} /></Link>
              </article>
            ))}
          </div>
          <p className={styles.pricingNote}>Need more detail? <Link href="/pricing">Compare all plans <ArrowUpRight size={14} /></Link></p>
        </div>
      </section>
    </>
  );
}
