# Deploying codeart.fun on Hostinger

This repository **is** the website: static HTML/JS/CSS plus a small PHP API in
`api/`. There is no build step, so Hostinger deploys straight from `main` and
no GitHub Action is needed.

## 1. Database (one time)

1. hPanel → **Databases → MySQL Databases**: create a database and user, e.g.
   `u900531748_codeart` / `u900531748_codeart`, with a strong password.
2. hPanel → **phpMyAdmin** → open that database → **Import** →
   choose `api/schema.sql` → Go. This creates five tables: `users`, `progress`,
   `drafts`, `submissions` and `auth_attempts`. Re-importing is safe.

## 2. Configure the API

1. Copy `api/config.sample.php` to `api/config.php`.
2. Fill in the database name, user and password from step 1. Keep
   `'secure_cookies' => true`.
3. Never commit `config.php` (it is listed in `.gitignore`).

PHP **8.1 or newer** is required (hPanel → Advanced → PHP Configuration). Check
that the `pdo_mysql` and `mbstring` extensions are enabled; they are by default.

## 3. Connect Hostinger to this repo (auto-deploy from `main`)

1. hPanel → add **codeart.fun** as a website. Then open **Advanced → Git** for it.
2. Repository: `git@github.com:light-vp/codeart.fun.git` · Branch: **`main`** ·
   Install path: `public_html`.
3. Copy the SSH key Hostinger shows. In GitHub → this repo → **Settings → Deploy
   keys**, add it **read-only**. Use a per-repo key, never an account SSH key.
4. Turn on **Auto-deployment**, copy its webhook URL, and add it in GitHub →
   **Settings → Webhooks** (content type `application/json`, push events).
5. Put `api/config.php` on the server once, with File Manager (step 2 above).
   It is git-ignored, so deploys never overwrite or delete it.

Every push to `main` is then live within seconds. Dev-only files (`tools/`,
`screenshots/`, Markdown) are copied too, but the root `.htaccess` blocks
access to them.

Enable the free SSL certificate (hPanel → Security → SSL). `.htaccess` then
redirects every request to HTTPS.

## 4. Check it

- `https://codeart.fun/` shows the landing page with the animated demo.
- `https://codeart.fun/learn` (or `/app.html`) opens the workspace. A
  **Sign in** button in the top bar means the API answered. If the button
  is missing, open `https://codeart.fun/api/me.php`: it should return
  `{"user":null}`. A message saying the server isn't configured means
  `config.php` is missing or in the wrong folder.
- Create an account, solve a level, then open the site in a private
  window and sign in. Your progress should be there.

## How the pieces fit

| Path | What it does |
| --- | --- |
| `index.html`, `js/landing.js` | Landing page. The hero replays `data/hero-trace.json`, so it needs no Python. |
| `app.html`, `js/app.js` | The workspace: levels, editor, 3D stage, solutions, history, account. |
| `py/tracer.py` | Runs inside Pyodide in the visitor's browser. Code never executes on your server. |
| `api/*.php` | Accounts (sessions + `password_hash`), progress, drafts, submissions. |
| `api/schema.sql` | MySQL tables. |

Nothing in the API executes user code; it only stores it. Every query uses
prepared statements. Sign-in is rate-limited per email and per IP, and
cross-site requests are blocked by the required `X-CodeArt` header together
with SameSite cookies.

## Local development

```sh
# static only (accounts hidden; progress kept in localStorage)
npx http-server .

# with the API, against SQLite
bash tools/test-api.sh          # end-to-end API tests
node tools/validate-levels.mjs  # every level and solution
```
