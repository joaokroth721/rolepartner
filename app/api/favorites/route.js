import { getDb, resolveUser, json, fail, oops } from "../../db";
import { wrongOrigin } from "../../guard";
import { favKey, FAV_TYPES } from "../../favkey";
import { normalizeTag } from "../../tags";

// Fields that live in their own column; everything else in the item is type-specific and
// rides along in `payload`, so a new favorite type needs no migration.
const COLUMNS = ["type", "tag", "scenario", "reviews", "date", "ts", "createdAt"];

const toClient = (row) => ({
  ...JSON.parse(row.payload),
  type: row.type,
  tag: row.tag || undefined,
  scenario: row.scenario || undefined,
  reviews: row.reviews,
  createdAt: row.created_at,
});

export async function GET(req) {
  try {
    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    const { results } = await db
      .prepare("SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC")
      .bind(user.id)
      .all();
    return json({ favorites: (results || []).map(toClient) }, { setCookie, clearCookie });
  } catch (e) {
    return oops("favorites.get", e);
  }
}

export async function POST(req) {
  const bad = wrongOrigin(req);
  if (bad) return bad;
  try {
    const item = await req.json();
    const type = item.type || "correction";
    if (!FAV_TYPES.includes(type)) return fail("Unbekannter Favoriten-Typ.", 400);

    const key = favKey({ ...item, type });
    const payload = Object.fromEntries(Object.entries(item).filter(([k]) => !COLUMNS.includes(k)));

    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    await db
      .prepare(
        `INSERT INTO favorites (user_id, fav_key, type, payload, tag, scenario, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, fav_key) DO NOTHING`
      )
      .bind(
        user.id,
        key,
        type,
        JSON.stringify(payload),
        type === "correction" ? normalizeTag(item.tag) : null,
        item.scenario || null,
        new Date().toISOString()
      )
      .run();

    const row = await db
      .prepare("SELECT * FROM favorites WHERE user_id = ? AND fav_key = ?")
      .bind(user.id, key)
      .first();
    return json({ favorite: toClient(row) }, { setCookie, clearCookie });
  } catch (e) {
    return oops("favorites.post", e);
  }
}

// Unstar. The key is type-aware (see app/favkey.js), so it is unique per user.
export async function DELETE(req) {
  const bad = wrongOrigin(req);
  if (bad) return bad;
  try {
    const key = new URL(req.url).searchParams.get("key");
    if (!key) return fail("Kein Schlüssel angegeben.", 400);
    const db = await getDb();
    const { user, setCookie, clearCookie } = await resolveUser(db, req);
    await db.prepare("DELETE FROM favorites WHERE user_id = ? AND fav_key = ?").bind(user.id, key).run();
    return json({ ok: true }, { setCookie, clearCookie });
  } catch (e) {
    return oops("favorites.delete", e);
  }
}
