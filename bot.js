// Iron: Discord verification bot + login server + the site itself (served from ./public).
// Quick start: see README.md  (npm install -> fill .env -> npm start -> run /verify-panel in Discord)
require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder,
        ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const express = require('express'), crypto = require('crypto');
const { TOKEN, CLIENT_ID, CLIENT_SECRET, GUILD_ID, ROLE_ID, BASE_URL, PORT = 3000 } = process.env;
// Staff can publish posts on the site. Discord usernames or user IDs (IDs are safer), comma-separated.
const STAFF = (process.env.STAFF || 'c3_nti,t.me.iron').toLowerCase().split(',').map(s => s.trim());
const SITE_URL = (process.env.SITE_URL || BASE_URL).replace(/\/$/, ''); // same domain by default: the bot serves ./public
const CK = SITE_URL === BASE_URL ? { sameSite: 'lax', secure: BASE_URL.startsWith('https') } : { sameSite: 'none', secure: true };
const REDIRECT = BASE_URL + '/auth/callback', sessions = new Map(); // sessions reset on restart
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

const giveRole = async id =>
  (await bot.guilds.cache.get(GUILD_ID)?.members.fetch(id).catch(() => null))?.roles.add(ROLE_ID).catch(() => {});

bot.once('ready', async () => {
  const cmd = new SlashCommandBuilder().setName('verify-panel').setDescription('Post the verification panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  await new REST().setToken(TOKEN).put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [cmd.toJSON()] });
  console.log('Bot online:', bot.user.tag);
});

bot.on('interactionCreate', async i => {
  if (i.isChatInputCommand() && i.commandName === 'verify-panel') {
    const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setLabel('Verify').setStyle(ButtonStyle.Link).setURL(BASE_URL + '/auth/discord'));
    await i.channel.send({
      components: [row],
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Verification')
        .setDescription('Press **Verify** and authorize with Discord to unlock the server.'),
    });
    return i.reply({ content: 'Panel posted.', flags: 64 });
  }
  if (i.isButton() && i.customId === 'verify') {
    await giveRole(i.user.id);
    i.reply({ content: 'You are verified.', flags: 64 });
  }
});

// ---- OAuth2 server used by the website ("Continue with Discord") ----
const app = express();
const cookie = r => Object.fromEntries((r.headers.cookie || '').split('; ').map(c => c.split('=')));

app.use((q, r, n) => {
  r.set({ 'Access-Control-Allow-Origin': SITE_URL, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization' });
  if (q.method === 'OPTIONS') return r.sendStatus(204);
  n();
});

const sidOf = q => (q.get('authorization') || '').replace('Bearer ', '') || cookie(q).sid;
app.use(express.static(require('path').join(__dirname, 'public')));

app.get('/auth/discord', (q, r) => {
  const state = crypto.randomBytes(12).toString('hex');
  r.cookie('st', state, { httpOnly: true, maxAge: 6e5, ...CK });
  r.redirect('https://discord.com/oauth2/authorize?' + new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', scope: 'identify', redirect_uri: REDIRECT, state }));
});

app.get('/auth/callback', async (q, r) => {
  try {
    if (q.query.error) return r.redirect(SITE_URL); // pressed Cancel on Discord
    if (!q.query.state || q.query.state !== cookie(q).st) return r.status(400).send('Login expired. Go back to the site and try again.');
    const t = await (await fetch('https://discord.com/api/oauth2/token', { method: 'POST', body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code',
      code: q.query.code, redirect_uri: REDIRECT }) })).json();
    const u = await (await fetch('https://discord.com/api/users/@me',
      { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
    const sid = crypto.randomBytes(24).toString('hex');
    const cdn = (k, h) => h && `https://cdn.discordapp.com/${k}/${u.id}/${h}.${h.startsWith('a_') ? 'gif' : 'png'}?size=${k === 'banners' ? 600 : 128}`;
    sessions.set(sid, { name: u.username, display: u.global_name || u.username,
      avatar: cdn('avatars', u.avatar) || `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`,
      banner: cdn('banners', u.banner) || null, bannerColor: u.banner_color || null,
      staff: STAFF.includes(u.username.toLowerCase()) || STAFF.includes(u.id) });
    await giveRole(u.id); // logging in on the site also verifies you in the server
    r.clearCookie('st', CK);
    r.cookie('sid', sid, { httpOnly: true, maxAge: 6048e5, ...CK });
    // site on another domain: hand the session over in the URL fragment (browsers block third-party cookies)
    r.send('<body style="background:#1e1f22;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh;margin:0">You are verified. You can close this tab and return to Discord.</body>'); }
});

app.get('/api/me', (q, r) => r.json(sessions.get(sidOf(q)) || {}));
app.get('/auth/logout', (q, r) => {
  sessions.delete(sidOf(q));
  r.clearCookie('sid', CK);
  r.json({});
});

bot.login(TOKEN);
app.listen(PORT, () => console.log('Auth server on :' + PORT));
