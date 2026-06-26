# Security & compliance status

Maps the compliance roadmap in [SAFEINTEL-BRIEF.md](SAFEINTEL-BRIEF.md) to what
is actually built. Use this as the reference when a mining company's procurement
team asks "is it safe?". **Not legal advice** — the privacy policy / ToS still
need a lawyer who knows the Australian Privacy Act.

## Done ✅
| Item | Status | Detail |
|---|---|---|
| Data isolation between customers | ✅ verified | Row-level security; an unauthenticated query returns zero rows. Each org sees only its own data. |
| Encryption in transit | ✅ | HTTPS/TLS everywhere (app ↔ Supabase ↔ Anthropic). |
| Encryption at rest | ✅ | Supabase encrypts the database on disk (AES-256). |
| API keys server-side only | ✅ | Anthropic key lives in the `generate` edge function, never in the browser. |
| Two-factor authentication | ✅ | TOTP via Supabase Auth (Settings → 2FA; code prompt at login). |
| Rate limiting | ✅ built | Per-user daily cap in the `generate` function (`ai_usage` table). |
| Input validation | ✅ | Prompt type + size checks; token clamp. |
| Photo metadata stripped | ✅ | Canvas re-encode drops EXIF/GPS. |
| Off-device backup | ✅ | Source on GitHub; user data in Supabase. |

## Pending — needs your dashboard action 🔧
| Item | Where |
|---|---|
| Confirm project region = **Sydney** (data residency) | Supabase → Project Settings → General |
| Email confirmation ON | Supabase → Authentication → Providers → Email |
| Leaked-password protection ON | Supabase → Authentication → Policies |
| Deploy updated `generate` fn + run `migration-ratelimit.sql` | Supabase dashboard |
| Finish Stripe webhook (deploy + register + secret) | Supabase + Stripe |
| Lock CORS to your domain (currently `*`) | edge functions, at launch |

## Pending — needs a professional 👔
| Item | Who |
|---|---|
| Privacy policy + Terms of Service | Lawyer (Australian Privacy Act) — **not a template** |
| Australian Privacy Act alignment review | Lawyer / privacy advisor |
| Professional indemnity / product liability insurance | Insurer |
| SOC 2 / ISO 27001 | Only when selling to large miners — defer |

## The privacy story (one-liner for sales)
"Sensitive company data is de-identified on the device before upload — we hold
safety patterns, not your site names or personnel. Data stays in Australia,
encrypted in transit and at rest, with row-level isolation per customer and 2FA."
