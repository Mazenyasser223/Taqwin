---
topic: Athlete platform FAQ
tags: [athlete, faq, app, logging, plans]
lang: en
locale: en
docType: platform
audience: athlete
---
# Taqwin for athletes — FAQ

This knowledge is for **athletes using the Taqwin mobile/web app**. Trainers and gym owners have separate dashboards; the AI coach in chat focuses on the logged-in athlete's profile, plans, and logs.

## What can I do in the app?

- Complete **onboarding** (goals, injuries, allergies, religious diet, budget, workout location).
- Chat with the **AI coach** about training, nutrition, recovery, and how to use Taqwin.
- View **today's diet and workout** on the dashboard after a plan is generated.
- **Log food** against daily calorie and macro targets.
- Browse the **exercise library** (MuscleWiki-linked) and **food catalog** (FoodItem + Webteb).
- Regenerate or adjust plans when your coach or settings allow (see plan limits below).

## What the AI coach can and cannot do

| Can | Cannot |
|-----|--------|
| Suggest meals using foods from Taqwin's database (with IDs) | Invent foods, brands, or macros not in the catalog |
| Explain exercises from the library | Prescribe medication or diagnose injury |
| Summarize your today's logs and targets from your profile | Change another user's data |
| Ground training/nutrition advice in licensed coaching books | Replace a doctor or registered dietitian |

## Plans and limits

- **Diet plan**: 7-day structure with meals built from `foodItemId` or `webtebId` entries only.
- **Workout plan**: 4-week structure with exercises from the Postgres exercise catalog.
- If onboarding is incomplete (e.g. missing weight), the coach may ask **one short question** before giving precise calorie targets.
- The coach does **not** claim it logged food or saved a plan unless a tool confirms it (future app actions).

## Language

- Default replies: **Egyptian Arabic** (عامية مصرية).
- If the athlete writes in **English** or sets locale to `en`, replies may be in simple English.
- Food names in answers follow the user's language: Arabic name for `ar`, English when available for `en`.

## Privacy and safety

- Chat uses your profile, today's plan, and food logs — not other athletes' data.
- Pain, pregnancy, eating disorders, or chronic illness → see a **doctor** or **dietitian**; the coach gives general fitness guidance only.

## Getting help inside Taqwin

- "How do I log lunch?" → platform help (L1).
- "Swap bench press — shoulder hurts" → exercise library + coaching principles (L2 + books).
- "High-protein dinner under 500 kcal" → nutrition catalog (L3) + books for principles.
- "help" or "what can you help with?" → getting started guide (L1) — workout, nutrition, app features, or your progress today.

## Exporting workout history

- **Profile → Activity / Workout history** — view past logged sessions on the dashboard.
- **Export** downloads your workout history when the in-app export action is available in your app version.
- The AI coach explains where to find history; use the **Export** button in the app to download the file.
