import express from 'express';
import serverless from 'serverless-http';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getDatabase, getConnectionString } from '@netlify/database';

const app = express();
const db = getDatabase({ connectionString: getConnectionString() });
const SESSION_SECRET = process.env.SESSION_SECRET || 'CHANGE-ME-ERELEC';
const COOKIE_NAME = 'erelec_session';

app.use(express.json());

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}
function makeSession(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, name: user.name, role: user.role, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function readSession(req) {
  const raw = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return user.exp > Date.now() ? user : null;
  } catch { return null; }
}
function setSession(res, user) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${makeSession(user)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=28800`);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
}
function auth(req, res, next) {
  const user = readSession(req);
  if (!user) return res.status(401).json({ error: 'Connexion requise' });
  req.user = user;
  next();
}
function admin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrateur requis' });
  next();
}

let initialized = false;
async function initDb() {
  if (initialized) return;
  const users = await db.sql`SELECT id FROM users LIMIT 1`;
  if (!users.length) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMoi123!', 10);
    await db.sql`INSERT INTO users(name, username, password, role) VALUES ('Administrateur ERELEC', 'admin', ${hash}, 'admin')`;
  }
  const products = [
    ['3G1,5', 'Câble 3G1,5', 'Câbles', 'm'],
    ['5G6', 'Câble 5G6', 'Câbles', 'm'],
    ['IRL 25', 'Tube IRL 25', 'Gaines', 'm'],
    ['ICI 32', 'Gaine ICI 32', 'Gaines', 'm']
  ];
  for (const p of products) {
    await db.sql`INSERT INTO products(ref,name,category,unit) VALUES (${p[0]},${p[1]},${p[2]},${p[3]}) ON CONFLICT (ref) DO NOTHING`;
  }
  initialized = true;
}

app.use(async (req, res, next) => {
  try { await initDb(); next(); } catch (e) { console.error(e); res.status(500).json({ error: 'Base de données indisponible' }); }
});

app.post('/login', async (req, res) => {
  const rows = await db.sql`SELECT * FROM users WHERE username=${req.body.username} LIMIT 1`;
  const u = rows[0];
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password)) return res.status(401).json({ error: 'Identifiants incorrects' });
  const user = { id: u.id, name: u.name, role: u.role };
  setSession(res, user);
  res.json(user);
});
app.post('/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });
app.get('/me', (req, res) => res.json(readSession(req)));

app.get('/products', auth, async (req, res) => {
  const q = (req.query.q || '').trim();
  const rows = await db.sql`SELECT * FROM products WHERE ref ILIKE ${'%' + q + '%'} OR name ILIKE ${'%' + q + '%'} ORDER BY name LIMIT 100`;
  res.json(rows);
});

app.post('/orders', auth, async (req, res) => {
  const { site, comment, items } = req.body;
  if (!site || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Chantier et articles obligatoires' });
  const order = await db.sql`INSERT INTO orders(user_id,site,comment) VALUES (${req.user.id},${site},${comment || ''}) RETURNING id`;
  for (const i of items) if (Number(i.qty) > 0) await db.sql`INSERT INTO order_items(order_id,product_id,qty) VALUES (${order[0].id},${Number(i.product_id)},${Number(i.qty)})`;
  res.json({ id: order[0].id });
});

app.get('/orders', auth, async (req, res) => {
  const rows = await db.sql`SELECT o.*,u.name AS user_name FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`;
  for (const o of rows) {
    const items = await db.sql`SELECT oi.qty,p.ref,p.name,p.unit FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=${o.id}`;
    o.items = items;
  }
  res.json(rows);
});

app.patch('/orders/:id/status', auth, async (req, res) => {
  const allowed = ['A_PREPARER','EN_PREPARATION','PRETE','ANNULEE'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Statut invalide' });
  await db.sql`UPDATE orders SET status=${req.body.status} WHERE id=${Number(req.params.id)}`;
  res.json({ ok: true });
});

app.post('/products', auth, admin, async (req, res) => {
  try {
    const r = await db.sql`INSERT INTO products(ref,name,category,unit) VALUES (${req.body.ref},${req.body.name},${req.body.category || ''},${req.body.unit || 'pièce'}) RETURNING id`;
    res.json({ id: r[0].id });
  } catch { res.status(400).json({ error: 'Référence déjà existante ou données invalides' }); }
});

export const handler = serverless(app, { basePath: '/.netlify/functions/api' });
