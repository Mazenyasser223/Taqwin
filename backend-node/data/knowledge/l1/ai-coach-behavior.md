---
topic: AI coach (athlete)
tags: [platform, ai-coach, chat, features]
lang: en
locale: en
docType: platform
---
# Taqwin AI coach (athlete)

The **Smart Coach** (المدرب الذكي) is Taqwin's in-app chat for athletes. It answers questions about training, nutrition, your saved plan, and how to use the app.

## What the coach can help with

- **Today's plan** — meals and workout from your active weekly plan (also on the dashboard without opening chat).
- **Food logging** — how to log meals and understand macros against your daily targets.
- **Exercise alternatives** — swaps from Taqwin's exercise catalog (respecting injuries from your profile).
- **Platform help** — onboarding, dashboard, community, gym membership, and app features.
- **Your progress** — profile, body metrics, logs, and plan targets when you ask about your data.

## Where the coach gets information

- Your **profile and onboarding** answers (goals, injuries, diet preferences).
- Your **active plan** and **food/workout logs**.
- Taqwin's **food catalog** and **exercise library** (IDs must match the database).
- **Coaching books** licensed in Taqwin for training and nutrition principles.

Behavior rules (language, safety, tool confirmations) are enforced by the coach system prompt in FastAPI, not stored in this FAQ document.

## Regenerating your plan

From **Profile → Regenerate plan**. Each regeneration creates a new plan version; the previous plan is deactivated. If AI validation fails, Taqwin saves a safe deterministic fallback plan instead of invalid JSON.

## Related topics

See also: platform overview, athlete features (Arabic), onboarding and plans FAQ, and athlete platform FAQ in this knowledge set.
