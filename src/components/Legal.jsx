import { useState } from 'react'
import { FullScreenModal } from './ui'

// Customer-facing legal documents. Plain-English, tailored to this app and
// Australian law. NOT a substitute for a lawyer's review before commercial sale
// to companies — but covers testing/early use and looks professional.
const BUSINESS = 'Synrad AI'
const CONTACT = 'synradai@outlook.com'
const EFFECTIVE = '28 June 2026'

const H = ({ children }) => <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-soft)', margin: '1.25rem 0 0.4rem' }}>{children}</h3>
const P = ({ children }) => <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: '0 0 0.6rem' }}>{children}</p>
const LI = ({ children }) => <li style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '0.3rem' }}>{children}</li>
const UL = ({ children }) => <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.1rem' }}>{children}</ul>
const Meta = () => <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600, margin: '0 0 0.5rem' }}>Effective {EFFECTIVE} · {BUSINESS}</p>

function Privacy() {
  return (
    <div>
      <Meta />
      <P>This Privacy Policy explains how {BUSINESS} ("we", "us") handles personal information when you use the Safe Intelligence app. We handle personal information in line with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</P>

      <H>What we collect</H>
      <UL>
        <LI><b>Account details</b> — your name and email address.</LI>
        <LI><b>Content you enter</b> — shift notes, site observations, incident and field-leadership reports, daily logs, photos, and questions you ask the AI assistant ("Gaz").</LI>
        <LI><b>Usage &amp; technical data</b> — basic information needed to run and secure the service (e.g. login times, device/browser type).</LI>
        <LI><b>Billing data</b> — handled by Stripe; we do not store your card details.</LI>
      </UL>

      <H>Sensitive information — your responsibility</H>
      <P>Safety records can contain other people's personal information (e.g. names of workers involved in an incident). Only enter what is necessary, and use the app's de-identification tools where you can. You are responsible for having a lawful basis to record information about other people.</P>

      <H>How we use it</H>
      <P>To provide and maintain the app, generate AI safety guidance and reports, keep your data backed up and isolated to your account, process your subscription, and improve the service.</P>

      <H>AI processing and overseas disclosure</H>
      <P>To generate responses and reports, content you submit is sent to our AI provider, <b>Anthropic</b>, which processes it on servers located in the <b>United States</b>. By using the AI features you consent to this overseas disclosure. We send only what is needed to produce the result and do not sell your data.</P>

      <H>Where your data is stored</H>
      <P>Your account and content are stored in our database (Supabase), encrypted in transit (HTTPS/TLS) and at rest. Each customer's data is isolated by row-level security so you can only ever see your own. Two-factor authentication is available.</P>

      <H>Service providers</H>
      <UL>
        <LI><b>Supabase</b> — database, authentication, hosting of backend functions.</LI>
        <LI><b>Anthropic</b> — AI processing (USA).</LI>
        <LI><b>Stripe</b> — payment processing.</LI>
        <LI><b>GitHub Pages</b> — app hosting.</LI>
      </UL>

      <H>Retention</H>
      <P>We keep your data while your account is active. You can delete your content in the app, and you can ask us to delete your account and associated data (see contact below).</P>

      <H>Access, correction and complaints</H>
      <P>You can access and correct most information directly in the app. To request access, correction, deletion, or to make a privacy complaint, email <b>{CONTACT}</b>. If you are not satisfied with our response, you can contact the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.</P>

      <H>Changes</H>
      <P>We may update this policy. We'll change the effective date above and, for material changes, let you know in the app.</P>
    </div>
  )
}

function Terms() {
  return (
    <div>
      <Meta />
      <P>These Terms of Service govern your use of the Safe Intelligence app provided by {BUSINESS}. By creating an account or using the app, you agree to these terms.</P>

      <H>The service</H>
      <P>Safe Intelligence is a tool that helps safety advisors record shift activity, observations, incidents and reports, and provides AI-assisted guidance and report drafting. It is a workflow and assistance tool only.</P>

      <H>Your account</H>
      <P>You must provide accurate details, keep your password secure, and are responsible for activity under your account. Don't share your login. You must be authorised to use the app for your work.</P>

      <H>Subscription &amp; billing</H>
      <UL>
        <LI>Paid subscriptions are billed through Stripe at the price shown at checkout.</LI>
        <LI>A free trial may be offered; access continues only if you subscribe before or when it ends.</LI>
        <LI>You can cancel anytime; cancellation stops future billing and applies from the end of the current billing period.</LI>
        <LI>Except where required by the Australian Consumer Law, payments are non-refundable.</LI>
      </UL>

      <H>Acceptable use</H>
      <P>You agree not to:</P>
      <UL>
        <LI>use the app unlawfully or to record information you have no right to record;</LI>
        <LI>enter other people's sensitive or health information beyond what is reasonably necessary;</LI>
        <LI>attempt to break, overload, reverse-engineer, or gain unauthorised access to the app;</LI>
        <LI>misuse the AI features (e.g. to generate harmful, misleading, or unlawful content);</LI>
        <LI>resell or share access without our permission.</LI>
      </UL>

      <H>AI &amp; safety disclaimer</H>
      <P>The AI assistant and AI-generated reports provide general assistance only. They are <b>not</b> professional safety, legal, engineering, or medical advice, may be incomplete or incorrect, and must not be relied on for emergencies. You remain responsible for all safety decisions and must verify outputs against site procedures, qualified judgement, and applicable laws. See the "AI &amp; Safety" tab for the full disclaimer.</P>

      <H>Your content</H>
      <P>You own the content you enter. You grant us the limited rights needed to store, process, and display it to provide the service (including sending it to our AI provider to generate results).</P>

      <H>Our intellectual property</H>
      <P>The Safe Intelligence app — including its software, source code, design, layout, look and feel, text, logos and branding — is owned by {BUSINESS} and protected by copyright. © {new Date().getFullYear()} {BUSINESS}. All rights reserved. You may use the app under these terms, but you must not copy, reproduce, modify, reverse-engineer, distribute, resell, or create derivative works from any part of it without our written permission. Access for evaluation or testing does not transfer any ownership or licence beyond using the app as intended.</P>

      <H>Consumer guarantees &amp; liability</H>
      <P>Nothing in these terms excludes rights you have under the Australian Consumer Law. To the maximum extent permitted by law, the app is provided "as is", and {BUSINESS} is not liable for indirect or consequential loss, or for decisions made in reliance on AI output. Where liability cannot be excluded, it is limited to resupplying the service or the amount you paid in the prior 12 months.</P>

      <H>Termination</H>
      <P>You can stop using the app and delete your account anytime. We may suspend or terminate access for breach of these terms.</P>

      <H>Governing law</H>
      <P>These terms are governed by the laws of Western Australia, Australia.</P>

      <H>Contact</H>
      <P>Questions? Email <b>{CONTACT}</b>.</P>
    </div>
  )
}

function AISafety() {
  return (
    <div>
      <Meta />
      <H>Important — read this</H>
      <P>Safe Intelligence includes an AI assistant ("Gaz") and AI-generated reports. These are tools to help you work faster — they are <b>not a substitute for your professional judgement.</b></P>
      <UL>
        <LI><b>Not professional advice.</b> AI output is general guidance only — not legal, safety, engineering, medical, or compliance advice.</LI>
        <LI><b>It can be wrong.</b> AI can be inaccurate, outdated, or incomplete. Always verify against current legislation, codes of practice, your site's procedures, and a competent person.</LI>
        <LI><b>You stay responsible.</b> You are accountable for every safety decision and every report you issue. Review and correct AI drafts before relying on or sharing them.</LI>
        <LI><b>Not for emergencies.</b> In an emergency, follow your site's emergency procedures and contact emergency services — do not use the app for emergency response.</LI>
      </UL>
      <P>By using the AI features, you accept that {BUSINESS} is not liable for decisions made in reliance on AI output, to the maximum extent permitted by law.</P>
    </div>
  )
}

const TABS = [
  { key: 'privacy', label: 'Privacy', render: Privacy },
  { key: 'terms', label: 'Terms', render: Terms },
  { key: 'ai', label: 'AI & Safety', render: AISafety },
]

export default function Legal({ onClose, initialTab = 'privacy' }) {
  const [tab, setTab] = useState(initialTab)
  const Current = (TABS.find(t => t.key === tab) || TABS[0]).render

  return (
    <FullScreenModal badge="§" title="Legal & Privacy" onClose={onClose}>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: '0.35rem 0.8rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, backgroundColor: tab === t.key ? 'var(--accent)' : 'var(--border)', color: tab === t.key ? 'var(--on-accent)' : 'var(--text-muted)' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Current />
    </FullScreenModal>
  )
}
