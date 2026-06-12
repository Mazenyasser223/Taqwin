---
topic: Taqwin platform overview
tags: [platform, taqwin, features, dashboard]
lang: en
locale: en
---
# What is Taqwin?

Taqwin is a fitness platform for athletes and gym owners. It combines onboarding questionnaires, personalized AI coaching chat, weekly diet and workout plans, food logging, exercise catalogs, pgvector RAG (L1–L3 + L5 books), and community features.

## Core features

- **Onboarding questionnaire** collects goals, injuries, allergies, religious diet, budget, workout location, and optional InBody / progress photos.
- **AI coach chat** answers training and nutrition questions in Egyptian Arabic (or English when the user writes in English). It uses the user's profile, today's plan, food logs, Taqwin food database, and licensed coaching books as context.
- **AI plans** generate a 7-day diet plan and 4-week workout plan after onboarding. Foods and exercises must come from Taqwin catalogs (Postgres); the validator rejects unknown IDs.
- **Dashboard** shows today's meals, workout, macros, and progress without opening chat.
- **Food logging** tracks what the athlete ate against daily targets.

## Knowledge layers (coach prompt order)

The AI coach shows knowledge to the model in this order:

1. **L5 — Coaching books** (primary philosophy for training, nutrition principles, habits).
2. **L1 — Platform internal** (this document set): athlete FAQ, features, onboarding.
3. **L2 — Exercise library**: MuscleWiki-linked exercises in Postgres.
4. **L3 — Nutrition**: FoodItem and Webteb foods (bilingual names, macros, servings).

Platform help → L1 + L5. Exercise swaps → L2 + L5. Meals → L3 + L5. General fitness chat → L5 + L1.

## Safety

The AI coach does not diagnose medical conditions, prescribe medication, or recommend steroids. Users with pain, pregnancy, or clinical conditions are directed to a doctor or registered dietitian.
