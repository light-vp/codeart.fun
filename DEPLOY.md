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

## 2. Configure the API (after the first deploy in step 3)

The API reads the database password from a settings file that exists only on
the server. Keep it **outside the website folder**, so it has no web address:

```
domains/codeart.fun/
├── codeart-config.php   ← put it here: no URL can reach this folder
└── public_html/         ← the website (deployed from this repo)
```

1. hPanel → the codeart.fun website → **File Manager**. Open `public_html`, then
   go **up one level** to the folder that contains it.
2. Create `codeart-config.php` there and paste in the contents of
   `api/config.sample.php`.
3. Fill in the database name, user and password from step 1. Keep
   `'secure_cookies' => true`. `<?php` must be the very first thing in the file.
4. Optional: set its permissions to `600`, or `640` if the API then says it is
   not configured.

The API looks for `codeart-config.php` above the web root first, then falls back
to `public_html/api/config.php`, so either location works. Use the first unless
your host blocks access above the web root. Neither file is ever committed;
both are git-ignored.

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
5. Then create the settings file (step 2). It sits outside `public_html` and
   isn't in git, so deploys never touch it.

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
  `{"user":null}`. "The server is not configured yet" means the settings file
  isn't where the API looks: check it is named `codeart-config.php` and sits in
  the folder *containing* `public_html`, not inside it. "Database unavailable"
  means it was found but a database name, user or password in it is wrong.
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
