import { auth } from "./auth";
import { fail } from "./db";

/**
 * Who may open /admin.
 *
 * Email only, and only a Google-verified one. The rp_uid cookie is a value the browser
 * hands us: it identifies a browser, it does not prove anything, so an anonymous visitor
 * can never clear this gate no matter what they send. Everything behind it reads across
 * all users, which is exactly the boundary db.js is careful about everywhere else.
 */

/**
 * The bootstrap list, from the environment.
 *
 * The `admins` table starts empty, and the UI that fills it is itself behind this gate,
 * so without a way in from outside the database the first admin could never be created.
 * These emails are admins whether or not they are in the table and cannot be removed
 * through the UI, which also makes them the recovery path if the table is emptied by
 * accident.
 */
export const bootstrapAdmins = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export async function isAdminEmail(db, email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (bootstrapAdmins().includes(lower)) return true;
  const row = await db.prepare("SELECT email FROM admins WHERE email = ?").bind(lower).first();
  return Boolean(row);
}

// The signed-in Google email, or null. Auth.js throws when its secrets are absent, which
// is a normal state in this app (see db.js), so that is a "not signed in", not a 500.
export async function signedInEmail() {
  try {
    const session = await auth();
    return session?.user?.email?.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Gate for every /api/admin route. Returns `{ email }` or `{ error }` to return as-is.
 *
 * Deliberately does NOT call resolveUser: that mints a user row and an identity cookie
 * on first contact, and a stranger probing /api/admin should leave no trace in `users`.
 */
export async function requireAdmin(db) {
  const email = await signedInEmail();
  if (!email) return { error: fail("Nicht angemeldet.", 401) };
  if (!(await isAdminEmail(db, email))) return { error: fail("Kein Zugriff.", 403) };
  return { email };
}

/**
 * JSON for an admin response, marked never to be stored.
 *
 * Everything these routes return is other people's data. Without a cache directive a
 * browser is free to keep a 200 in its disk cache, and on a shared machine the next
 * person to open the page is the one who reads it; an intermediary cache is the same
 * problem one hop further away. The gate is per-request, so the answer must be too.
 */
export const adminJson = (data) => Response.json(data, { headers: { "cache-control": "no-store" } });

// Anything that is not one address with one @ and no spaces is rejected before it can be
// stored: an entry that can never match a Google email is only a way to lose track of
// who actually has access.
export const cleanEmail = (raw) => {
  const email = String(raw || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};
