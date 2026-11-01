// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const ann = { tokenIdentifier: "clerk|ann", subject: "ann", email: "ann@example.org" };
const bo = { tokenIdentifier: "clerk|bo", subject: "bo", email: "bo@example.org" };
const BOOKENDS = "A substitute ordinance relating to the change in zoning ... at 711 East Kilbourn Avenue and 822 North Van Buren Street.";
const lot = { taxkey: "3930942000", address: "711 E KILBOURN AV", zoning: "PD", alder: 4, lotAreaSqFt: null, owner: null, polygon: null, centroid: { lat: 43.04246, lng: -87.90278 } };

async function bookends() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 74560, fileNumber: "260533", title: BOOKENDS, typeName: "Ordinance", statusName: "In Council-Passage" });
  await t.mutation(internal.legistar.setMatterParcels, { matterId: 74560, parcels: [lot] });
  return t;
}
// A Council decision on Bookends, recorded as a change by the normal history upsert.
const decide = (t: ReturnType<typeof convexTest>, legistarId = 9001) =>
  t.mutation(internal.legistar.upsertHistory, { legistarId, matterId: 74560, date: "2026-11-04T00:00:00", bodyName: "COMMON COUNCIL", actionName: "PASSED", passed: true });
const alertsOf = async (t: ReturnType<typeof convexTest>, who: typeof ann) => (await t.withIdentity(who).query(api.watcher.inbox, {}))!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("follows", () => {
  it("need sign-in; browsing stays public", async () => {
    const t = await bookends();
    await expect(t.mutation(api.follows.follow, { kind: "file", value: "260533", label: "Bookends" })).rejects.toThrow(/sign in/i);
    expect(await t.query(api.follows.myFollows, {})).toBeNull();
  });
  it("are stored once, validated, and an address keeps only rounded coordinates", async () => {
    const t = await bookends();
    const a = t.withIdentity(ann);
    await a.mutation(api.follows.follow, { kind: "file", value: "260533", label: "711 E. Kilbourn Ave." });
    await a.mutation(api.follows.follow, { kind: "file", value: "260533", label: "711 E. Kilbourn Ave." });
    await a.mutation(api.follows.follow, { kind: "address", value: "43.042681123,-87.902957476", label: "Near 1234 N Home St" });
    await expect(a.mutation(api.follows.follow, { kind: "alder", value: "99", label: "x" })).rejects.toThrow();
    await expect(a.mutation(api.follows.follow, { kind: "address", value: ",", label: "x" })).rejects.toThrow();
    await expect(a.mutation(api.follows.follow, { kind: "file", value: "26053'", label: "x" })).rejects.toThrow();
    expect((await a.query(api.follows.myFollows, {}))!.map((f) => [f.kind, f.value])).toEqual([
      ["file", "260533"],
      ["address", "43.043,-87.903"],
    ]);
    // The street the client sent as a label is never stored, in the follow or the activity log.
    const stored = JSON.stringify([await a.query(api.follows.myFollows, {}), await a.query(api.watcher.activity, {})]);
    expect(stored).toContain("Area within half a mile of 43.043, -87.903");
    expect(stored).not.toMatch(/Home St/);
    expect(await a.query(api.follows.isFollowing, { kind: "file", value: "260533" })).toBe(true);
    await a.mutation(api.follows.unfollow, { kind: "file", value: "260533" });
    expect(await a.query(api.follows.isFollowing, { kind: "file", value: "260533" })).toBe(false);
  });
});

describe("Watcher", () => {
  it("a decision on 260533 alerts its follower and not a 260532 follower; running twice yields one alert", async () => {
    const t = await bookends();
    await t.withIdentity(ann).mutation(api.follows.follow, { kind: "file", value: "260533", label: "Bookends" });
    await t.withIdentity(bo).mutation(api.follows.follow, { kind: "file", value: "260532", label: "Southgate" });
    await decide(t);
    await t.action(internal.watcher.runWatcher, {});
    await t.action(internal.watcher.runWatcher, {});
    const inbox = await alertsOf(t, ann);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ message: "711 E. Kilbourn Ave. and 822 N. Van Buren St.: Passed at Common Council, Nov 4, 2026.", href: "/files/260533", replay: false });
    expect(await alertsOf(t, bo)).toEqual([]);
  });
  it("an address follow matches a lot within half a mile", async () => {
    const t = await bookends();
    await t.withIdentity(ann).mutation(api.follows.follow, { kind: "address", value: "43.0430,-87.9000", label: "Near home" });
    await decide(t);
    await t.action(internal.watcher.runWatcher, {});
    expect(await alertsOf(t, ann)).toHaveLength(1);
  });
  it("quiet by default: no alert for changes from before the follow, none for a plain step", async () => {
    const t = await bookends();
    await decide(t, 1); // before Ann follows
    await t.withIdentity(ann).mutation(api.follows.follow, { kind: "file", value: "260533", label: "Bookends" });
    await t.mutation(internal.legistar.upsertHistory, { legistarId: 2, matterId: 74560, date: "2026-11-05T00:00:00", bodyName: "MAYOR", actionName: "SENT TO MAYOR" });
    await t.action(internal.watcher.runWatcher, {});
    expect(await alertsOf(t, ann)).toEqual([]);
  });
  it("emails only when RESEND_API_KEY is set, with an unsubscribe link; unsubscribing stops email, not on-site alerts", async () => {
    const sent: { to: string; text: string }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      sent.push({ to: body.to, text: body.text });
      return new Response(JSON.stringify({ id: "e1" }), { status: 200 });
    });
    const t = await bookends();
    await t.withIdentity(ann).mutation(api.follows.follow, { kind: "file", value: "260533", label: "Bookends" });
    await decide(t, 1);
    await t.action(internal.watcher.runWatcher, {}); // no key: on-site only
    expect(sent).toEqual([]);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("SITE_URL", "https://minutes.example");
    await decide(t, 2);
    await t.action(internal.watcher.runWatcher, {});
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ann@example.org");
    const token = /unsubscribe\?token=([a-f0-9]+)/.exec(sent[0].text)![1];
    await t.mutation(api.watcher.unsubscribe, { token });
    await decide(t, 3);
    await t.action(internal.watcher.runWatcher, {});
    expect(sent).toHaveLength(1);
    expect(await alertsOf(t, ann)).toHaveLength(3);
  });
  it("no SITE_URL: alerts stay on the site, no email is sent", async () => {
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", async () => (sent.push(1), new Response("{}", { status: 200 })));
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const t = await bookends();
    await t.withIdentity(ann).mutation(api.follows.follow, { kind: "file", value: "260533", label: "Bookends" });
    await decide(t, 1);
    await t.action(internal.watcher.runWatcher, {});
    expect(sent).toEqual([]);
    expect(await alertsOf(t, ann)).toHaveLength(1);
  });
  it("the email toggle works for someone who has never followed anything", async () => {
    const t = await bookends();
    await t.withIdentity(bo).mutation(api.watcher.setEmailAlerts, { on: false });
    expect(await t.withIdentity(bo).query(api.watcher.emailSettings, {})).toEqual({ email: "bo@example.org", on: false });
  });
  it("replays carry replay: true and the original date, and only admins can make them", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "admin1");
    const t = await bookends();
    await decide(t, 1); // a real past change
    await t.withIdentity(ann).mutation(api.follows.follow, { kind: "file", value: "260533", label: "Bookends" });
    await expect(t.withIdentity(ann).mutation(api.watcher.replayChange, { sourceKey: "history:1" })).rejects.toThrow(/admin/i);
    await t.withIdentity({ tokenIdentifier: "clerk|admin1", subject: "admin1" }).mutation(api.watcher.replayChange, { sourceKey: "history:1" });
    const inbox = await alertsOf(t, ann);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ replay: true, replayOf: "2026-11-04T00:00:00" });
  });
});
