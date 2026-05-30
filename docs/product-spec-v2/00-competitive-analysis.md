# 00 — Competitive Context & Design Direction

## The Landscape

The grant management market is dominated by cloud SaaS platforms — polished, powerful, and expensive. They charge $299–$999+/month, store your grant data on their servers, and target generic nonprofits with multi-user complexity.

Hacker Dojo doesn't need any of that. It needs a tool that works locally, knows Hacker Dojo's mission, and helps one person manage the full grant lifecycle without setup overhead.

## Our Position

| Market Standard | Our Approach |
|---|---|
| Cloud SaaS with recurring fees | **Local-first**, no subscription |
| Your data on their servers | **Everything on your machine** |
| Generic nonprofit configuration | **Hardcoded for Hacker Dojo** |
| Multi-user roles and teams | **Single-user, zero overhead** |
| Web-based with latency | **Local desktop, instant** |
| Setup wizard with org onboarding | **Works on launch — profile pre-loaded** |
| Separate tools for discovery, writing, tracking | **One integrated workflow** |

## Design Direction

### What We Aspire To

- Professional, clean interface that feels like a well-crafted desktop app
- Dark, warm palette — like a makerspace after hours
- AI assistance woven into workflows, not bolted on
- Card-based layouts with clear information hierarchy
- Progressive disclosure — powerful features accessible but not overwhelming

### What We Avoid

- Cold corporate aesthetics
- Feature bloat from enterprise SaaS
- Setup wizards and onboarding flows
- Cloud dependency for any core feature
- Generic "one-size-fits-all" language

## Feature Selection Principle

Every feature answers: "Does this help Hacker Dojo win more grants, with less busywork?"

Features that serve multi-org SaaS economics (role management, team billing, enterprise SSO) don't make the cut. Features that save a single operator time (AI drafting, deadline intelligence, automated matching) are prioritized.
