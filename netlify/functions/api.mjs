import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { getDatabase } from "@netlify/database";

const db = getDatabase();
const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE-ME-ERELEC";
const COOKIE_NAME = "erelec_session";
let initialized = false;

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}
function makeSession(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id, name: user.name, role: user.role,
    exp: Date.now() + 8 * 60 * 60 * 1000
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function readSession(req) {
  const raw = req.headers.get("cookie")?.split(";").map(x => x.trim())
    .find(x => x.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  const expected = sign(payload || "");
  if (!payload || !sig || sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString());
    return user.exp > Date.now() ? user : null;
  } catch { return null; }
}
function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}
function cookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}
async function initDb() {
  if (initialized) return;
  await db.sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user'
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY, ref TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    category TEXT, unit TEXT DEFAULT 'pièce'
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), site TEXT NOT NULL,
    comment TEXT, status TEXT NOT NULL DEFAULT 'A_PREPARER',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id), qty DOUBLE PRECISION NOT NULL
  )`;

  const users = await db.sql`SELECT id FROM users LIMIT 1`;
  if (!users.length) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "ChangeMoi123!", 10);
    await db.sql`INSERT INTO users(name, username, password, role)
      VALUES (${"Administrateur ERELEC"}, ${"admin"}, ${hash}, ${"admin"})`;
  }
  const products = [
    ["3G1,5","Câble 3G1,5","Câbles","m"],
    ["5G6","Câble 5G6","Câbles","m"],
    ["IRL 25","Tube IRL 25","Gaines","m"],
    ["ICI 32","Gaine ICI 32","Gaines","m"]
  ];
  for (const p of products)
    await db.sql`INSERT INTO products(ref,name,category,unit)
      VALUES (${p[0]},${p[1]},${p[2]},${p[3]}) ON CONFLICT (ref) DO NOTHING`;
  initialized = true;
}

function requireUser(req) {
  return readSession(req);
}

export default async function handler(req) {
  try {
    await initDb();

    const url = new URL(req.url);
    let path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "");
    if (!path) path = "/";
    const method = req.method.toUpperCase();
    const user = requireUser(req);

    if (method === "POST" && path === "/login") {
      const body = await req.json();
      const rows = await db.sql`SELECT * FROM users WHERE username=${body.username} LIMIT 1`;
      const u = rows[0];
      if (!u || !bcrypt.compareSync(body.password || "", u.password))
        return json({error:"Identifiants incorrects"}, 401);
      const safe = {id:u.id, name:u.name, role:u.role};
      return json(safe, 200, {"Set-Cookie": cookieHeader(makeSession(safe), 28800)});
    }

    if (method === "POST" && path === "/logout")
      return json({ok:true}, 200, {"Set-Cookie": cookieHeader("", 0)});

    if (method === "GET" && path === "/me")
      return json(user);

    if (!user) return json({error:"Connexion requise"}, 401);

    if (method === "GET" && path === "/products") {
      const q = (url.searchParams.get("q") || "").trim();
      const rows = await db.sql`SELECT * FROM products
        WHERE ref ILIKE ${"%"+q+"%"} OR name ILIKE ${"%"+q+"%"}
        ORDER BY name LIMIT 100`;
      return json(rows);
    }

    if (method === "POST" && path === "/orders") {
      const body = await req.json();
      if (!body.site || !Array.isArray(body.items) || !body.items.length)
        return json({error:"Chantier et articles obligatoires"},400);
      const order = await db.sql`INSERT INTO orders(user_id,site,comment)
        VALUES (${user.id},${body.site},${body.comment || ""}) RETURNING id`;
      for (const i of body.items)
        if (Number(i.qty)>0)
          await db.sql`INSERT INTO order_items(order_id,product_id,qty)
            VALUES (${order[0].id},${Number(i.product_id)},${Number(i.qty)})`;
      return json({id:order[0].id});
    }

    if (method === "GET" && path === "/orders") {
      const rows = await db.sql`SELECT o.*,u.name AS user_name
        FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`;
      for (const o of rows)
        o.items = await db.sql`SELECT oi.qty,p.ref,p.name,p.unit
          FROM order_items oi JOIN products p ON p.id=oi.product_id
          WHERE oi.order_id=${o.id}`;
      return json(rows);
    }

    const statusMatch = path.match(/^\/orders\/(\d+)\/status$/);
    if (method === "PATCH" && statusMatch) {
      const body = await req.json();
      const allowed = ["A_PREPARER","EN_PREPARATION","PRETE","ANNULEE"];
      if (!allowed.includes(body.status)) return json({error:"Statut invalide"},400);
      await db.sql`UPDATE orders SET status=${body.status} WHERE id=${Number(statusMatch[1])}`;
      return json({ok:true});
    }

    if (method === "POST" && path === "/products") {
      if (user.role !== "admin") return json({error:"Administrateur requis"},403);
      try {
        const body = await req.json();
        const r = await db.sql`INSERT INTO products(ref,name,category,unit)
          VALUES (${body.ref},${body.name},${body.category||""},${body.unit||"pièce"}) RETURNING id`;
        return json({id:r[0].id});
      } catch { return json({error:"Référence déjà existante ou données invalides"},400); }
    }

    return json({error:"Route introuvable"},404);
  } catch (e) {
    console.error("ERELEC API ERROR", e);
    return json({error:"Erreur serveur / base de données", detail: process.env.NODE_ENV === "production" ? undefined : String(e?.message || e)},500);
  }
}
