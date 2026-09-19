import { getDb, oops, fail } from "../../db";
import { requireAdmin, adminJson } from "../../admin";
import { knownScenario } from "../../guard";
import {
  overview,
  userList,
  adminList,
  challenges,
  methodology,
  conversationList,
  conversation,
  conversationStats,
} from "../../adminreport";

// Everything the /admin dashboard reads, behind one gate.
//
// One route with a `view` switch rather than five, because the gate is the hard part and
// five copies of it are five chances to forget one. Read-only: the only thing the admin
// page writes is the allow list, which lives in ./admins.
//
// `fail()` here, not `json()`: this route must never mint or hand back an identity
// cookie, so a stranger probing it leaves nothing behind (see app/admin.js).

const PAGE = 25;
const MAX_USERS = 200;

export async function GET(req) {
  try {
    const db = await getDb();
    const { email, error } = await requireAdmin(db);
    if (error) return error;

    const params = new URL(req.url).searchParams;
    const view = params.get("view") || "overview";

    if (view === "overview") return adminJson({ you: email, ...(await overview(db)) });

    if (view === "users") {
      return adminJson({
        users: await userList(db, MAX_USERS),
        admins: await adminList(db),
        limit: MAX_USERS,
      });
    }

    if (view === "challenges") {
      // Only the per-scenario play counts, not the whole overview: the token and visit
      // aggregates behind it cost four more queries that this view never draws.
      const { byScenario } = await conversationStats(db);
      return adminJson({ challenges: challenges(byScenario), methodology: methodology() });
    }

    if (view === "conversations") {
      const asked = params.get("id");
      if (asked !== null) {
        const found = await conversation(db, Number(asked));
        if (!found) return fail("Gespräch nicht gefunden.", 404);
        return adminJson({ conversation: found });
      }
      const scenarioId = knownScenario(params.get("scenarioId"))?.id || null;
      return adminJson(
        await conversationList(db, { limit: PAGE, before: params.get("before"), scenarioId })
      );
    }

    return fail("Unbekannte Ansicht.", 400);
  } catch (e) {
    return oops("admin", e);
  }
}
