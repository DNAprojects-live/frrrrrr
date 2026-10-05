# Iron bot

Discord verification bot + login server + the Iron site, in one Node app.

- `/verify-panel` posts a panel with a **Verify** button (gives the Verified role) and a link to log in on the site.
- "Continue with Discord" on the site logs people in, gives them the Verified role and loads their Discord username, display name, avatar and banner.
- The same server serves the site from `public/`.

## Setup

1. Open https://discord.com/developers/applications and create a **New Application**.
2. **General Information**: copy the Application ID into `CLIENT_ID`.
3. **OAuth2**: copy the Client Secret into `CLIENT_SECRET`. Under **Redirects** add `BASE_URL/auth/callback`
   (locally: `http://localhost:3000/auth/callback`).
4. **Bot**: Reset Token and copy it into `TOKEN`. No privileged intents are needed.
5. Invite the bot (replace CLIENT_ID):
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=268454912`
6. In your server create a role such as `Verified`, then in Server Settings > Roles drag the bot's role **above** it.
   Turn on Developer Mode (User Settings > Advanced), right-click the server > Copy Server ID into `GUILD_ID`,
   right-click the role > Copy Role ID into `ROLE_ID`.
7. Copy `.env.example` to `.env` and fill it in.
8. Run `npm install`, then `npm start` (Node 18+). Open `BASE_URL` in the browser.
9. In Discord run `/verify-panel` in the channel where the panel should appear (admins only).

## Hosting

Login needs a public HTTPS address (Render, Railway, Fly.io, a VPS...). Set `BASE_URL` to it, add
`BASE_URL/auth/callback` to the OAuth2 Redirects and keep the process running.

If the site lives on another domain (e.g. Vercel), set `SITE_URL=https://irondevport.vercel.app` for the bot, put the bot's public address into `const BOT` at the top of the script in `public/index.html`, and deploy that file to the site. Vercel only hosts the page: the bot must run on a server that stays on (Render, Railway, Fly.io, a VPS) with HTTPS. After login the bot sends the session back to the site in the URL (`#sid=...`), so it works without third-party cookies.

## Customising the site (`public/index.html`)

- Staff (publish posts, blue check): set `STAFF` in `.env` to Discord usernames or user IDs (IDs are safer). Default: `c3_nti,t.me.iron`. Everyone else who logs in can react and comment.
- `BG`: badges shown after a username. `ROLE`: role shown on the profile (Teacher gets the crown and black ring).
- `DC`: Discord invite link.

## Notes

- The Discord consent screen shows your application's name and icon (Developer Portal > General Information).
- Open the site at `BASE_URL`. Opening `index.html` as a file cannot log in.
- Sessions are kept in memory, so a restart logs everyone out.
- Posts, comments and reactions live in the page's memory only. Sharing them between visitors needs a database.
