# GitHub — Taqwin

## Repository

| Item | Value |
|------|--------|
| URL | https://github.com/Mazenyasser223/Taqwin |
| Remote | `origin` → `https://github.com/Mazenyasser223/Taqwin.git` |
| Push account | `ahmedsaid108239-dev` (collaborator) |

## Push (after you signed in once)

Credentials are stored by **Git Credential Manager** on Windows. From repo root:

```bash
git push -u origin HEAD
```

Or use the script:

```bash
bash scripts/push-github.sh
# optional: bash scripts/push-github.sh feature/community-complete
```

## Branches

- `main` — production default
- `feature/community-complete` — community feed, stories, groups, inbox (latest)
- `feature/community-social` — earlier community branch

## First-time / 403 errors

1. Create a [Personal Access Token](https://github.com/settings/tokens) (`repo` scope) on **ahmedsaid108239-dev**.
2. Remove old GitHub entries in **Windows Credential Manager** (anything for `git:https://github.com`).
3. Run `git push` again; username = `ahmedsaid108239-dev`, password = the token.

Do **not** commit tokens or put them in this repo.
