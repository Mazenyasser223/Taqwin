# How to create the GitHub repo and push

Follow these steps to create the repo on GitHub and push this folder.

---

## Option A — Using GitHub website

1. **Create the repo on GitHub**
   - Go to [github.com](https://github.com) and sign in.
   - Click **+** (top right) → **New repository**.
   - **Repository name:** `Taqwin` (or `taqwin`).
   - **Description:** `AI-powered fitness management platform`.
   - Choose **Public**.
   - Do **not** add a README, .gitignore, or license (we already have them).
   - Click **Create repository**.

2. **Initialize Git locally and push**
   - Open a terminal in the project folder:  
     `m:\Faculty\Graduation Project\Taqwin`
   - Run:

   ```bash
   git init
   git add .
   git commit -m "Initial repo structure: frontend, backend-node, ai-service, docs"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/Taqwin.git
   git push -u origin main
   ```

   - Replace `YOUR_USERNAME` with your GitHub username.
   - If GitHub asks for login, use a **Personal Access Token** (Settings → Developer settings → Personal access tokens) instead of your password.

---

## Option B — Using GitHub CLI (`gh`)

If you have [GitHub CLI](https://cli.github.com/) installed:

```bash
cd "m:\Faculty\Graduation Project\Taqwin"
git init
git add .
git commit -m "Initial repo structure: frontend, backend-node, ai-service, docs"
gh repo create Taqwin --public --source=. --remote=origin --push
```

---

## After the first push

- Share the repo URL with your team (e.g. `https://github.com/YOUR_USERNAME/Taqwin`).
- Next we can add our Agile/Scrum doc and database design under `docs/`.
