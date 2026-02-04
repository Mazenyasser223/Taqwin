# Taqwin — Our Agile/Scrum Methodology

This document defines how we run the project (separate from the PDF’s methodology).

---

## 1. Why we have this doc

**Role:** So the team has one place for sprint length, roles, and ceremonies. We can change it as we go.

---

## 2. Sprint length

| Choice   | Value | Role |
|----------|--------|------|
| **Sprint duration** | **2 weeks** | Balance between delivery speed and stability; we can switch to 3 weeks if needed. |

---

## 3. Roles (simplified)

| Role | Responsibility |
|------|-----------------|
| **Product Owner** | Prioritizes backlog; says what “done” means for features. |
| **Scrum Master** | Keeps process clear; removes blockers; runs ceremonies. |
| **Development Team** | Implements features (frontend, backend-node, ai-service). |

One person can hold more than one role (e.g. dev + Scrum Master).

---

## 4. Ceremonies

| Ceremony | When | Purpose |
|----------|------|---------|
| **Sprint Planning** | Start of each sprint | Pick backlog items for the sprint; agree on sprint goal. |
| **Daily (optional)** | Short sync | Quick status: what I did, what’s next, any blocker. |
| **Sprint Review** | End of sprint | Demo what was built; get feedback. |
| **Retrospective** | End of sprint | What went well, what to improve in process/tools. |

---

## 5. Backlog and “Definition of Done”

- **Product Backlog:** List of features/tasks (from TAQWIN spec + our DB/API design).  
- **Sprint Backlog:** Subset we commit to in one sprint.  
- **Definition of Done (example):** Code merged to `main`, reviewed (if we use PRs), and documented enough for the team to run/test.

We’ll refine the backlog when we lock the database design and first sprint scope.

---

## 6. Next step

- Backlog will be filled once we have the **database design** and **first sprint scope** (e.g. auth + user API + React shell).
- See `docs/DATABASE-DESIGN.md` for the data model we build together.
