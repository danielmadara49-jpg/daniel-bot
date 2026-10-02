// Bot WhatsApp (Baileys) - base modulaire. Node 18+
// Lancer : npm install && node index.js  (puis scanner le QR)
const {
  default: makeWASocket, useMultiFileAuthState, DisconnectReason,
  fetchLatestBaileysVersion, downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const { Sticker } = require('wa-sticker-formatter');

// ---------- CONFIG ----------
const CFG = {
  prefix: '.',
  botName: '༆DanielMadara༆',
  owners: ['242064734055'],      // ton numéro, sans + (le compte connecté est toujours owner)
  packName: '༆DanielMadara༆',
  authorName: 'Bot',
};

// ---------- STOCKAGE (DATA_DIR = volume persistant sur l'hébergeur) ----------
const DATA = process.env.DATA_DIR || '.';
fs.mkdirSync(DATA, { recursive: true });
if (process.env.COOKIES_B64) fs.writeFileSync('./cookies.txt', Buffer.from(process.env.COOKIES_B64, 'base64'));

// ---------- MINI BASE DE DONNÉES ----------
const DB_FILE = DATA + '/db.json';
let db = { mode: 'private', groups: {}, warns: {}, afk: null };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) }; } catch {}
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const grp = (id) => (db.groups[id] ||= { antilink: false, welcome: false, goodbye: false, warnLimit: 3 });

// ---------- REGISTRE DE COMMANDES ----------
const cmds = new Map();
const cats = {};
function cmd(names, opt, fn) {
  names = [].concat(names);
  const c = { names, ...opt, fn };
  names.forEach((n) => cmds.set(n, c));
  (cats[opt.cat || 'General'] ||= []).push(names[0]);
}

const startTime = Date.now();
const num = (jid = '') => jid.split('@')[0].split(':')[0];
const text = (m) => {
  const x = m.message?.ephemeralMessage?.message || m.message || {};
  return x.conversation || x.extendedTextMessage?.text || x.imageMessage?.caption || x.videoMessage?.caption || '';
};
const ctxInfo = (m) => {
  const x = m.message?.ephemeralMessage?.message || m.message || {};
  return Object.values(x).find((v) => v?.contextInfo)?.contextInfo;
};
const target = (m, args) => {
  const ci = ctxInfo(m);
  if (ci?.mentionedJid?.length) return ci.mentionedJid[0];
  if (ci?.participant) return ci.participant;
  const n = (args[0] || '').replace(/\D/g, '');
  return n ? n + '@s.whatsapp.net' : null;
};
const fmtTime = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${Math.floor(s % 60)}s`;

// ---------- COMMANDES : GÉNÉRAL ----------
cmd('ping', { desc: 'Latence' }, async (c) => {
  const t = Date.now();
  await c.reply('🏓 Pong...');
  await c.reply(`⚡ ${Date.now() - t} ms`);
});
cmd('alive', { desc: 'Bot en ligne' }, (c) => c.reply(`✅ ${CFG.botName} est en ligne.\nMode : ${db.mode}`));
cmd('uptime', { desc: 'Temps de fonctionnement' }, (c) => c.reply(`⏱️ ${fmtTime((Date.now() - startTime) / 1000)}`));
cmd('owner', { desc: 'Propriétaire' }, (c) => c.reply('👑 ' + CFG.owners.map((o) => '@' + o).join(', ')));
cmd('menu', { desc: 'Liste des commandes' }, (c) => {
  let out = `╭═〘 ${CFG.botName} 〙═⊷\n┃ prefix : ${CFG.prefix}\n┃ mode : ${db.mode}\n┃ commandes : ${cmds.size}\n╰═══════════⊷\n`;
  for (const [cat, list] of Object.entries(cats)) {
    out += `\n╭═〘 ${cat} 〙═⊷\n` + list.map((n, i) => `┃ ${i + 1}  ${CFG.prefix}${n}`).join('\n') + '\n╰═══════════⊷\n';
  }
  if (fs.existsSync('./menu.jpg'))
    return c.sock.sendMessage(c.jid, { image: { url: './menu.jpg' }, caption: out }, { quoted: c.msg });
  return c.reply(out);
});
cmd('mode', { cat: 'Settings', owner: true, desc: 'private/public' }, (c) => {
  const v = (c.args[0] || '').toLowerCase();
  if (!['private', 'public'].includes(v)) return c.reply(`Mode actuel : ${db.mode}\nUsage : ${CFG.prefix}mode private|public`);
  db.mode = v; save(); return c.reply(`Mode : ${v}`);
});
cmd('afk', { desc: 'Mode absent' }, (c) => {
  db.afk = c.args.length ? { reason: c.args.join(' '), since: Date.now() } : null; save();
  return c.reply(db.afk ? `😴 AFK activé : ${db.afk.reason}` : '👋 AFK désactivé');
});
cmd('weather', { desc: 'Météo : .weather Paris' }, async (c) => {
  if (!c.args.length) return c.reply('Usage : .weather <ville>');
  const r = await fetch(`https://wttr.in/${encodeURIComponent(c.args.join(' '))}?format=3&lang=fr`);
  return c.reply(await r.text());
});
cmd('forecast', { desc: 'Prévisions 3 jours' }, async (c) => {
  if (!c.args.length) return c.reply('Usage : .forecast <ville>');
  const r = await fetch(`https://wttr.in/${encodeURIComponent(c.args.join(' '))}?0TQ&lang=fr`);
  return c.reply('```' + (await r.text()) + '```');
});
cmd('quote', { cat: 'Utilitaire', desc: 'Citation aléatoire' }, async (c) => {
  const r = await (await fetch('https://zenquotes.io/api/random')).json();
  return c.reply(`💬 ${r[0].q}\n— ${r[0].a}`);
});
cmd('age', { desc: 'Âge : .age 2000-05-17' }, (c) => {
  const d = new Date(c.args[0]);
  if (isNaN(d)) return c.reply('Usage : .age AAAA-MM-JJ');
  const ms = Date.now() - d; const y = Math.floor(ms / 31557600000);
  return c.reply(`🎂 ${y} ans (${Math.floor(ms / 86400000)} jours)`);
});
cmd('cntd', { desc: 'Compte à rebours : .cntd 2026-12-31' }, (c) => {
  const d = new Date(c.args[0]);
  if (isNaN(d)) return c.reply('Usage : .cntd AAAA-MM-JJ');
  const s = (d - Date.now()) / 1000;
  return c.reply(s > 0 ? `⏳ ${Math.floor(s / 86400)} jours restants` : 'Date passée.');
});
cmd('roulette', { desc: 'Tire un membre au sort', group: true }, (c) => {
  const p = c.meta.participants[Math.floor(Math.random() * c.meta.participants.length)].id;
  return c.sock.sendMessage(c.jid, { text: `🎯 @${num(p)}`, mentions: [p] }, { quoted: c.msg });
});
cmd('poll', { desc: 'Sondage : .poll Question | A | B | C' }, (c) => {
  const [q, ...o] = c.args.join(' ').split('|').map((s) => s.trim()).filter(Boolean);
  if (!q || o.length < 2) return c.reply('Usage : .poll Question | A | B');
  return c.sock.sendMessage(c.jid, { poll: { name: q, values: o, selectableCount: 1 } });
});
cmd('jid', { desc: 'JID du chat' }, (c) => c.reply(c.jid));
cmd('react', { cat: 'Whatsapp', desc: 'Réagir : .react 🔥 (en répondant)' }, (c) => {
  const ci = ctxInfo(c.msg);
  if (!ci?.stanzaId) return c.reply('Réponds à un message.');
  return c.sock.sendMessage(c.jid, { react: { text: c.args[0] || '👍', key: { remoteJid: c.jid, id: ci.stanzaId, participant: ci.participant } } });
});
cmd('delete', { desc: 'Supprime un message (en répondant)' }, (c) => {
  const ci = ctxInfo(c.msg);
  if (!ci?.stanzaId) return c.reply('Réponds au message à supprimer.');
  return c.sock.sendMessage(c.jid, { delete: { remoteJid: c.jid, id: ci.stanzaId, participant: ci.participant, fromMe: num(ci.participant) === num(c.sock.user.id) } });
});
cmd('save', { cat: 'Utility', desc: 'Envoie le média cité dans ta discussion perso' }, async (c) => {
  const ci = ctxInfo(c.msg);
  if (!ci?.quotedMessage) return c.reply('Réponds à un message.');
  const buf = await downloadMediaMessage({ key: { remoteJid: c.jid, id: ci.stanzaId, participant: ci.participant }, message: ci.quotedMessage }, 'buffer', {});
  const q = ci.quotedMessage;
  const me = num(c.sock.user.id) + '@s.whatsapp.net';
  if (q.imageMessage) return c.sock.sendMessage(me, { image: buf, caption: q.imageMessage.caption || '' });
  if (q.videoMessage) return c.sock.sendMessage(me, { video: buf, caption: q.videoMessage.caption || '' });
  if (q.audioMessage) return c.sock.sendMessage(me, { audio: buf, mimetype: 'audio/mpeg' });
  return c.reply('Type de média non géré.');
});

// ---------- COMMANDES : EDIT ----------
cmd(['sticker', 's'], { cat: 'Edit', desc: 'Image/vidéo -> sticker (en répondant)' }, async (c) => {
  const ci = ctxInfo(c.msg);
  const holder = ci?.quotedMessage
    ? { key: { remoteJid: c.jid, id: ci.stanzaId, participant: ci.participant }, message: ci.quotedMessage }
    : c.msg;
  const m = holder.message || {};
  if (!(m.imageMessage || m.videoMessage)) return c.reply('Réponds à une image ou une courte vidéo.');
  const buf = await downloadMediaMessage(holder, 'buffer', {});
  const st = new Sticker(buf, { pack: CFG.packName, author: CFG.authorName, type: 'full', quality: 60 });
  return c.sock.sendMessage(c.jid, { sticker: await st.toBuffer() }, { quoted: c.msg });
});
cmd('photo', { cat: 'Edit', desc: 'Sticker -> image (en répondant)' }, async (c) => {
  const ci = ctxInfo(c.msg);
  if (!ci?.quotedMessage?.stickerMessage) return c.reply('Réponds à un sticker.');
  const buf = await downloadMediaMessage({ key: { remoteJid: c.jid, id: ci.stanzaId, participant: ci.participant }, message: ci.quotedMessage }, 'buffer', {});
  return c.sock.sendMessage(c.jid, { image: buf }, { quoted: c.msg });
});

// ---------- COMMANDES : GROUPE ----------
const G = { cat: 'Group', group: true, admin: true, botAdmin: true };
cmd('kick', G, async (c) => { const t = target(c.msg, c.args); if (!t) return c.reply('Mentionne quelqu\'un.'); await c.sock.groupParticipantsUpdate(c.jid, [t], 'remove'); });
cmd('add', G, async (c) => { const t = target(c.msg, c.args); if (!t) return c.reply('Usage : .add 336xxxxxxxx'); await c.sock.groupParticipantsUpdate(c.jid, [t], 'add'); });
cmd('promote', G, async (c) => { const t = target(c.msg, c.args); if (!t) return c.reply('Mentionne quelqu\'un.'); await c.sock.groupParticipantsUpdate(c.jid, [t], 'promote'); });
cmd('demote', G, async (c) => { const t = target(c.msg, c.args); if (!t) return c.reply('Mentionne quelqu\'un.'); await c.sock.groupParticipantsUpdate(c.jid, [t], 'demote'); });
cmd(['mute', 'glock'], G, async (c) => { await c.sock.groupSettingUpdate(c.jid, 'announcement'); return c.reply('🔇 Groupe en mode annonces.'); });
cmd(['unmute', 'gunlock'], G, async (c) => { await c.sock.groupSettingUpdate(c.jid, 'not_announcement'); return c.reply('🔊 Tout le monde peut écrire.'); });
cmd('gname', G, async (c) => { await c.sock.groupUpdateSubject(c.jid, c.args.join(' ')); });
cmd('gdesc', G, async (c) => { await c.sock.groupUpdateDescription(c.jid, c.args.join(' ')); });
cmd('invite', G, async (c) => c.reply('https://chat.whatsapp.com/' + (await c.sock.groupInviteCode(c.jid))));
cmd('revoke', G, async (c) => { await c.sock.groupRevokeInvite(c.jid); return c.reply('Lien réinitialisé.'); });
cmd('leave', { cat: 'Group', group: true, owner: true }, async (c) => { await c.sock.groupLeave(c.jid); });
cmd('ginfo', { cat: 'Group', group: true }, (c) => {
  const m = c.meta; const admins = m.participants.filter((p) => p.admin).length;
  return c.reply(`📌 ${m.subject}\n👥 ${m.participants.length} membres (${admins} admins)\n📝 ${m.desc || '-'}`);
});
cmd('tag', { cat: 'Group', group: true, admin: true }, (c) => {
  const ids = c.meta.participants.map((p) => p.id);
  const ci = ctxInfo(c.msg);
  const t = c.args.join(' ') || ci?.quotedMessage?.conversation || '📢';
  return c.sock.sendMessage(c.jid, { text: t, mentions: ids });
});
cmd('requests', G, async (c) => {
  const l = await c.sock.groupRequestParticipantsList(c.jid);
  return c.reply(l.length ? l.map((r) => '• ' + num(r.jid)).join('\n') : 'Aucune demande.');
});
cmd('acceptall', { cat: 'Admin', group: true, admin: true, botAdmin: true }, async (c) => {
  const l = await c.sock.groupRequestParticipantsList(c.jid);
  if (!l.length) return c.reply('Aucune demande.');
  await c.sock.groupRequestParticipantsUpdate(c.jid, l.map((r) => r.jid), 'approve');
  return c.reply(`✅ ${l.length} acceptées.`);
});
for (const k of ['antilink', 'welcome', 'goodbye']) {
  cmd(k, { cat: 'Group', group: true, admin: true, desc: `.${k} on|off` }, (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(v)) return c.reply(`${k} : ${grp(c.jid)[k] ? 'on' : 'off'}`);
    grp(c.jid)[k] = v === 'on'; save(); return c.reply(`${k} : ${v}`);
  });
}
cmd('warn', { cat: 'Group', group: true, admin: true, botAdmin: true }, async (c) => {
  const t = target(c.msg, c.args); if (!t) return c.reply('Mentionne quelqu\'un.');
  const k = c.jid + t; db.warns[k] = (db.warns[k] || 0) + 1; save();
  const lim = grp(c.jid).warnLimit;
  if (db.warns[k] >= lim) { await c.sock.groupParticipantsUpdate(c.jid, [t], 'remove'); delete db.warns[k]; save(); return c.reply('🚫 Limite atteinte, membre exclu.'); }
  return c.sock.sendMessage(c.jid, { text: `⚠️ @${num(t)} : ${db.warns[k]}/${lim}`, mentions: [t] });
});
cmd('warnings', { cat: 'Group', group: true }, (c) => {
  const t = target(c.msg, c.args) || c.sender;
  return c.reply(`Avertissements : ${db.warns[c.jid + t] || 0}/${grp(c.jid).warnLimit}`);
});
cmd(['resetwarn', 'rmwarn'], { cat: 'Group', group: true, admin: true }, (c) => {
  const t = target(c.msg, c.args); if (!t) return c.reply('Mentionne quelqu\'un.');
  delete db.warns[c.jid + t]; save(); return c.reply('✅ Remis à zéro.');
});
cmd('setwarnlimit', { cat: 'Group', group: true, admin: true }, (c) => {
  const n = parseInt(c.args[0]); if (!n) return c.reply('Usage : .setwarnlimit 3');
  grp(c.jid).warnLimit = n; save(); return c.reply('Limite : ' + n);
});

// ---------- COMMANDES : DOWNLOAD (yt-dlp + ffmpeg requis) ----------
const { execFile } = require('child_process');
fs.mkdirSync('./tmp', { recursive: true });
const ytdlp = (args) => new Promise((res, rej) =>
  execFile('yt-dlp', [...(fs.existsSync('./cookies.txt') ? ['--cookies', './cookies.txt'] : []), ...args],
    { maxBuffer: 50 * 1024 * 1024 }, (e, so, se) => (e ? rej(new Error((se || e.message).slice(-300))) : res(so))));
const ytTarget = (q) => (/^https?:\/\//.test(q) ? q : `ytsearch1:${q}`);

async function ytGet(c, kind) {
  if (!c.args.length) return c.reply(`Usage : ${CFG.prefix}${kind === 'audio' ? 'play' : 'video'} <titre ou lien>`);
  await c.reply('⏳ Téléchargement...');
  const fmt = kind === 'audio'
    ? ['-x', '--audio-format', 'mp3']
    : ['-f', 'bv*[height<=480]+ba/b[height<=480]/b', '--merge-output-format', 'mp4'];
  try {
    const out = await ytdlp([
      ...fmt, '--no-playlist', '--max-filesize', '60M', '--no-simulate',
      '-o', './tmp/%(id)s.%(ext)s', '--print', 'after_move:%(title)s\t%(filepath)s',
      ytTarget(c.args.join(' ')),
    ]);
    const [title, file] = out.trim().split('\n').pop().split('\t');
    const msg = kind === 'audio'
      ? { audio: { url: file }, mimetype: 'audio/mpeg', fileName: title + '.mp3' }
      : { video: { url: file }, caption: title };
    await c.sock.sendMessage(c.jid, msg, { quoted: c.msg });
    fs.unlink(file, () => {});
  } catch (e) {
    return c.reply('❌ Échec : ' + e.message);
  }
}
cmd(['play', 'song', 'yta'], { cat: 'Download', desc: 'Audio YouTube' }, (c) => ytGet(c, 'audio'));
cmd(['video', 'ytv'], { cat: 'Download', desc: 'Vidéo YouTube (480p max)' }, (c) => ytGet(c, 'video'));
cmd('yts', { cat: 'Download', desc: 'Recherche YouTube' }, async (c) => {
  if (!c.args.length) return c.reply('Usage : .yts <recherche>');
  try {
    const out = await ytdlp(['--flat-playlist', '--print', '%(title)s | %(duration_string)s\n%(url)s', `ytsearch5:${c.args.join(' ')}`]);
    return c.reply(out.trim());
  } catch (e) { return c.reply('❌ ' + e.message); }
});

// ---------- COMMANDES : RÉSEAUX SOCIAUX (yt-dlp) ----------
async function dlSocial(c) {
  const url = c.args[0];
  if (!/^https?:\/\//.test(url || '')) return c.reply('Usage : colle le lien après la commande.');
  await c.reply('⏳ Téléchargement...');
  try {
    const out = await ytdlp(['--no-playlist', '--max-filesize', '60M', '--no-simulate',
      '-o', './tmp/%(id)s.%(ext)s', '--print', 'after_move:filepath', url]);
    const file = out.trim().split('\n').pop();
    const msg = /\.(jpe?g|png|webp)$/i.test(file) ? { image: { url: file } } : { video: { url: file } };
    await c.sock.sendMessage(c.jid, msg, { quoted: c.msg });
    fs.unlink(file, () => {});
  } catch (e) {
    return c.reply('❌ Échec : ' + e.message + '\n(Instagram/Facebook demandent souvent des cookies dans cookies.txt)');
  }
}
cmd(['insta', 'ig'], { cat: 'Download', desc: 'Instagram' }, dlSocial);
cmd('fb', { cat: 'Download', desc: 'Facebook' }, dlSocial);
cmd('tiktok', { cat: 'Download', desc: 'TikTok' }, dlSocial);
cmd('pinterest', { cat: 'Download', desc: 'Pinterest' }, dlSocial);
cmd('story', { cat: 'Download', desc: 'Story Instagram (lien)' }, dlSocial);

// ---------- COMMANDES : IA ----------
// Nécessite la variable d'environnement ANTHROPIC_API_KEY
const aiHist = {};
async function askClaude(id, prompt) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY manquante');
  const h = (aiHist[id] ||= []);
  h.push({ role: 'user', content: prompt });
  while (h.length > 12) h.shift();
  while (h.length && h[0].role !== 'user') h.shift();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5', max_tokens: 800,
      system: 'Tu es un assistant WhatsApp. Réponds en français, de façon courte et claire.',
      messages: h,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || r.status);
  const t = d.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  h.push({ role: 'assistant', content: t });
  return t;
}
cmd('ai', { cat: 'General', desc: 'Pose une question à l\'IA' }, async (c) => {
  if (!c.args.length) return c.reply('Usage : .ai <question>');
  try { return c.reply(await askClaude(c.jid, c.args.join(' '))); } catch (e) { return c.reply('❌ ' + e.message); }
});
cmd('chatbot', { cat: 'General', owner: true, desc: '.chatbot on|off : l\'IA répond à tous les messages du chat' }, (c) => {
  const v = (c.args[0] || '').toLowerCase();
  db.chatbot ||= {};
  if (!['on', 'off'].includes(v)) return c.reply(`chatbot : ${db.chatbot[c.jid] ? 'on' : 'off'}`);
  db.chatbot[c.jid] = v === 'on'; save(); return c.reply('chatbot : ' + v);
});
cmd(['imagine', 'img'], { cat: 'Search', desc: 'Génère une image (Pollinations, gratuit)' }, async (c) => {
  if (!c.args.length) return c.reply('Usage : .imagine <description>');
  await c.reply('🎨 Génération...');
  try {
    const r = await fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(c.args.join(' ')));
    if (!r.ok) throw new Error('service indisponible');
    return c.sock.sendMessage(c.jid, { image: Buffer.from(await r.arrayBuffer()), caption: c.args.join(' ') }, { quoted: c.msg });
  } catch (e) { return c.reply('❌ ' + e.message); }
});

// ---------- COMMANDES : SPORT (TheSportsDB, clé gratuite "3") ----------
const SPORTS = { ligue1: [4334, 'Ligue 1'], premier: [4328, 'Premier League'], laliga: [4335, 'La Liga'],
  seriea: [4332, 'Serie A'], bundesliga: [4331, 'Bundesliga'], ucl: [4480, 'Ligue des champions'], cdm: [4429, 'Coupe du monde'] };
const season = () => { const d = new Date(), y = d.getFullYear(); return d.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`; };
const sdb = async (p) => (await fetch('https://www.thesportsdb.com/api/v1/json/3/' + p)).json();
for (const [name, [id, label]] of Object.entries(SPORTS)) {
  cmd(name, { cat: 'Sport', desc: `.${name} [matchs|resultats]` }, async (c) => {
    try {
      const sub = (c.args[0] || '').toLowerCase();
      if (sub.startsWith('match')) {
        const d = await sdb(`eventsnextleague.php?id=${id}`);
        if (!d.events) return c.reply('Aucun match à venir trouvé.');
        return c.reply(`📅 ${label} - prochains matchs\n` + d.events.slice(0, 10).map((e) => `${e.dateEvent} ${(e.strTime || '').slice(0, 5)}  ${e.strEvent}`).join('\n'));
      }
      if (sub.startsWith('res')) {
        const d = await sdb(`eventspastleague.php?id=${id}`);
        if (!d.events) return c.reply('Aucun résultat trouvé.');
        return c.reply(`✅ ${label} - derniers résultats\n` + d.events.slice(-10).map((e) => `${e.dateEvent}  ${e.strHomeTeam} ${e.intHomeScore}-${e.intAwayScore} ${e.strAwayTeam}`).join('\n'));
      }
      const d = await sdb(`lookuptable.php?l=${id}&s=${season()}`);
      if (!d.table) return c.reply(`Pas de classement dispo pour ${label}. Essaie : .${name} matchs`);
      return c.reply(`🏆 ${label} ${season()}\n` + d.table.slice(0, 20).map((t) => `${t.intRank}. ${t.strTeam}  ${t.intPoints} pts (${t.intPlayed} J, ${t.intGoalDifference} diff)`).join('\n'));
    } catch (e) { return c.reply('❌ ' + e.message); }
  });
}

// ---------- COMMANDES : OWNER ----------
cmd('block', { cat: 'Owner', owner: true }, async (c) => { const t = target(c.msg, c.args) || (!c.isGroup && c.jid); if (t) await c.sock.updateBlockStatus(t, 'block'); });
cmd('unblock', { cat: 'Owner', owner: true }, async (c) => { const t = target(c.msg, c.args) || (!c.isGroup && c.jid); if (t) await c.sock.updateBlockStatus(t, 'unblock'); });
cmd('join', { cat: 'Owner', owner: true }, async (c) => {
  const code = (c.args[0] || '').split('chat.whatsapp.com/')[1];
  if (!code) return c.reply('Usage : .join <lien>');
  await c.sock.groupAcceptInvite(code); return c.reply('✅ Rejoint.');
});
cmd('pp', { cat: 'Owner', owner: true }, async (c) => {
  const ci = ctxInfo(c.msg);
  if (!ci?.quotedMessage?.imageMessage) return c.reply('Réponds à une image.');
  const buf = await downloadMediaMessage({ key: { remoteJid: c.jid, id: ci.stanzaId, participant: ci.participant }, message: ci.quotedMessage }, 'buffer', {});
  await c.sock.updateProfilePicture(c.sock.user.id, buf); return c.reply('✅ Photo mise à jour.');
});
cmd('restart', { cat: 'System', owner: true }, async (c) => { await c.reply('♻️ Redémarrage...'); process.exit(0); });

// ---------- CONNEXION ----------
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(DATA + '/auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }) });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') console.log('✅ Connecté :', num(sock.user.id));
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) start();
      else console.log('Déconnecté. Supprime le dossier ./auth et relance.');
    }
  });

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    const g = grp(id);
    if (!(action === 'add' && g.welcome) && !(action === 'remove' && g.goodbye)) return;
    const meta = await sock.groupMetadata(id);
    for (const p of participants) {
      const jid = typeof p === 'string' ? p : p.id;
      const t = action === 'add' ? `👋 Bienvenue @${num(jid)} dans *${meta.subject}* !` : `😢 @${num(jid)} a quitté le groupe.`;
      await sock.sendMessage(id, { text: t, mentions: [jid] });
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;
        const jid = msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : jid;
        const body = text(msg);
        const isOwner = msg.key.fromMe || CFG.owners.includes(num(sender));
        const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

        let meta = null, isAdmin = false, isBotAdmin = false;
        if (isGroup) {
          meta = await sock.groupMetadata(jid);
          const adm = (id) => meta.participants.some((p) => p.admin && (p.id === id || num(p.id) === num(id)));
          isAdmin = adm(sender) || isOwner; isBotAdmin = adm(sock.user.id);
          // Anti-lien
          if (grp(jid).antilink && /chat\.whatsapp\.com\//i.test(body) && !isAdmin && isBotAdmin && !msg.key.fromMe) {
            await sock.sendMessage(jid, { delete: msg.key });
            await sock.groupParticipantsUpdate(jid, [sender], 'remove');
            continue;
          }
        }

        // AFK : répond si le propriétaire est mentionné
        const ci = ctxInfo(msg);
        if (db.afk && !msg.key.fromMe && ci?.mentionedJid?.some((j) => num(j) === num(sock.user.id)))
          await reply(`😴 Absent depuis ${fmtTime((Date.now() - db.afk.since) / 1000)} : ${db.afk.reason}`);

        if (!body.startsWith(CFG.prefix)) {
          if (db.chatbot?.[jid] && body && !msg.key.fromMe) {
            try { await reply(await askClaude(jid, body)); } catch (e) { console.error('chatbot :', e.message); }
          }
          continue;
        }
        const [name, ...args] = body.slice(CFG.prefix.length).trim().split(/\s+/);
        const c = cmds.get(name.toLowerCase());
        if (!c) continue;
        if (db.mode === 'private' && !isOwner) continue;
        if (c.owner && !isOwner) continue;
        if (c.group && !isGroup) return reply('Commande réservée aux groupes.');
        if (c.admin && !isAdmin) return reply('Réservé aux admins.');
        if (c.botAdmin && !isBotAdmin) return reply('Je dois être admin du groupe.');

        await c.fn({ sock, msg, jid, sender, args, text: args.join(' '), isGroup, meta, isAdmin, isBotAdmin, isOwner, reply });
      } catch (e) {
        console.error('Erreur commande :', e);
      }
    }
  });
}
start();
