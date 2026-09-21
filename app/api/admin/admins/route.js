import { getDb, fail, oops } from "../../../db";
import { requireAdmin, cleanEmail, bootstrapAdmins, adminJson } from "../../../admin";
import { wrongOrigin } from "../../../guard";
import { adminList } from "../../../adminreport";

// The allow list for /admin: add an email, and the next time that person signs in with
// Google they see the dashboard. Nothing here touches `users`: an admin may be added
// before they have ever opened the app, and the two lists are matched by email at the
// moment of the request, not linked by a foreign key.
//
// Every response returns the whole list, so the page never has to guess what the server
// now believes.

export async function GET() {
  try {
    const db = await getDb();
    const { error } = await requireAdmin(db);
    if (error) return error;
    return adminJson({ admins: await adminList(db) });
  } catch (e) {
    return oops("admin.admins.get", e);
  }
}

export async function POST(req) {
  const bad = wrongOrigin(req);
  if (bad) return bad;
  try {
    const db = await getDb();
    const { email: actor, error } = await requireAdmin(db);
    if (error) return error;

    // A body that is not JSON is the caller's mistake, not ours: `fail`, not `oops`.
    const body = await req.json().catch(() => null);
    const clean = cleanEmail(body?.email);
    if (!clean) return fail("Keine gültige E-Mail-Adresse.", 400);

    // An ADMIN_EMAILS address is already an admin, and a row for it would be invisible
    // (adminList shows it as pinned) and undeletable (DELETE refuses it) while still
    // granting access after the address is taken out of ADMIN_EMAILS. Nothing to do.
    if (!bootstrapAdmins().includes(clean)) {
      // INSERT OR IGNORE, not an existence check first: adding somebody who is already an
      // admin is what the person wanted anyway, and an error would only be noise.
      await db
        .prepare("INSERT OR IGNORE INTO admins (email, added_by, created_at) VALUES (?, ?, ?)")
        .bind(clean, actor, new Date().toISOString())
        .run();
    }

    return adminJson({ admins: await adminList(db), added: clean });
  } catch (e) {
    return oops("admin.admins.post", e);
  }
}

export async function DELETE(req) {
  const bad = wrongOrigin(req);
  if (bad) return bad;
  try {
    const db = await getDb();
    const { email: actor, error } = await requireAdmin(db);
    if (error) return error;

    const clean = cleanEmail(new URL(req.url).searchParams.get("email"));
    if (!clean) return fail("Keine gültige E-Mail-Adresse.", 400);
    // ADMIN_EMAILS is the recovery path and lives in the environment, not the database;
    // deleting the row would not revoke anything and would only look like it had. Checked
    // before the self check, because for your own pinned address "remove it from
    // ADMIN_EMAILS" is the answer and "you cannot remove yourself" is not.
    if (bootstrapAdmins().includes(clean)) {
      return fail("Diese Adresse kommt aus ADMIN_EMAILS und muss dort entfernt werden.", 400);
    }
    // Removing yourself is how a one-admin app locks everybody out of its own admin page.
    if (clean === actor) return fail("Du kannst dich nicht selbst entfernen.", 400);

    await db.prepare("DELETE FROM admins WHERE email = ?").bind(clean).run();
    return adminJson({ admins: await adminList(db), removed: clean });
  } catch (e) {
    return oops("admin.admins.delete", e);
  }
}
