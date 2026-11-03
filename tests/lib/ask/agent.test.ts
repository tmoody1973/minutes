import { describe, expect, it } from "vitest";
import { runAgent, type Tools } from "../../../lib/ask/agent";
import type { ChatMessage } from "../../../lib/meta/spark";

const rec = (key: string, text: string, href = "/files/251665") => ({ key, label: key, text, href });

const tools: Tools = {
  find_files: async () => [rec("matter:1", "File 251665 (Communication): MPD use of cameras including Flock. Status: In Committee.")],
  read_file: async () => [rec("history:9", "Feb 10, 2026: Common Council: Assigned to Public Safety and Health Committee.")],
  find_moments: async () => [],
  upcoming: async () => [],
};

// Scripted Muse: first asks for two lookups, then answers in JSON (later answers serve rewrite requests).
function scripted(answer: object, ...rewrites: object[]) {
  let turn = 0;
  const seen: ChatMessage[][] = [];
  const chat = async (messages: ChatMessage[]) => {
    seen.push(messages);
    turn++;
    if (turn === 1)
      return {
        role: "assistant" as const,
        tool_calls: [
          { id: "a", type: "function" as const, function: { name: "find_files", arguments: '{"query":"police cameras"}' } },
          { id: "b", type: "function" as const, function: { name: "read_file", arguments: '{"file_number":"251665"}' } },
        ],
      };
    return { role: "assistant" as const, content: JSON.stringify(turn === 2 ? answer : (rewrites[turn - 3] ?? { sentences: [] })) };
  };
  return { chat, seen };
}

describe("runAgent", () => {
  it("looks up records, then keeps only sentences the Editor passes", async () => {
    const { chat, seen } = scripted({
      sentences: [
        { text: "File 251665 is a police department communication about its use of cameras.", sources: ["matter:1"] },
        { text: "The committee approved it.", sources: ["history:404"] },
      ],
    });
    const steps: string[] = [];
    const out = await runAgent("What about police cameras?", tools, {
      chat,
      verify: async () => ({ supported: true, reason: "" }),
      onStep: (s) => steps.push(s),
    });

    expect(steps).toEqual(['Searching files for "police cameras"', "Reading file 251665", "Checking 2 sentences against the records"]);
    expect(out.sentences.map((s) => s.text)).toEqual(["File 251665 is a police department communication about its use of cameras."]);
    expect(out.sentences[0].sources.map((s) => s.key)).toEqual(["matter:1"]);
    expect(out.rejected).toBe(1);
    expect(out.records.map((r) => r.href)).toEqual(["/files/251665"]);
    // Tool results go back to the model as keyed lines it can cite.
    const toolMsg = seen[1].find((m) => m.role === "tool");
    expect(toolMsg && "content" in toolMsg ? toolMsg.content : "").toContain("[matter:1] File 251665");
  });

  it("passes on Muse's proposed words to follow, cleaned, and none when it proposes none", async () => {
    const verify = async () => ({ supported: true, reason: "" });
    const proposed = { sentences: [], follow: { name: "  Police surveillance cameras ", words: ["Camera", "flock", "camera", "x", 7, "license plate reader", "a", "b", "c", "d", "e"] } };
    const out = await runAgent("cameras", tools, { chat: scripted(proposed).chat, verify });
    expect(out.follow).toEqual({ name: "Police surveillance cameras", words: ["camera", "flock", "license plate reader"] });
    expect((await runAgent("cameras", tools, { chat: scripted({ sentences: [] }).chat, verify })).follow).toBeUndefined();
  });

  it("returns no sentences when the records don't answer", async () => {
    const { chat } = scripted({ sentences: [] });
    const out = await runAgent("Will it rain?", tools, { chat, verify: async () => ({ supported: true, reason: "" }) });
    expect(out.sentences).toEqual([]);
    expect(out.rejected).toBe(0);
  });

  it("drops a sentence with a judging word before asking the model", async () => {
    const { chat } = scripted({ sentences: [{ text: "The controversial cameras were discussed.", sources: ["matter:1"] }] });
    let asked = 0;
    const out = await runAgent("cameras", tools, {
      chat,
      verify: async () => {
        asked++;
        return { supported: true, reason: "" };
      },
    });
    expect(out.sentences).toEqual([]);
    expect(out.rejected).toBe(1);
    expect(asked).toBe(0);
  });
});

describe("runAgent sentence text", () => {
  it("strips record keys the model wrote into a sentence, keeping them as sources", async () => {
    const { chat } = scripted({ sentences: [{ text: "File 251665 is about cameras [matter:1].", sources: ["matter:1"] }] });
    const out = await runAgent("cameras", tools, { chat, verify: async () => ({ supported: true, reason: "" }) });
    expect(out.sentences[0].text).toBe("File 251665 is about cameras.");
  });
});

describe("runAgent rewrite pass", () => {
  const editor = async (text: string) => ({ supported: !text.includes("reviewed"), reason: "Records say it is still in committee." });

  it("sends a rejected sentence back once with the Editor's reason, and keeps the rewrite if it passes", async () => {
    const { chat, seen } = scripted(
      { sentences: [{ text: "File 251665 is about cameras.", sources: ["matter:1"] }, { text: "The city reviewed it.", sources: ["history:9"] }] },
      { sentences: [{ text: "File 251665 was assigned to the Public Safety and Health Committee.", sources: ["history:9"] }] },
    );
    const steps: string[] = [];
    const out = await runAgent("cameras", tools, { chat, verify: editor, onStep: (s) => steps.push(s) });
    expect(out.sentences.map((s) => s.text)).toEqual(["File 251665 is about cameras.", "File 251665 was assigned to the Public Safety and Health Committee."]);
    expect(out.rejected).toBe(0);
    expect(steps).toContain("Rewriting 1 sentence the Editor sent back");
    const ask = seen[2].at(-1);
    expect(ask && "content" in ask ? ask.content : "").toContain("Records say it is still in committee.");
  });

  it("drops a sentence whose rewrite also fails", async () => {
    const { chat } = scripted(
      { sentences: [{ text: "The city reviewed it.", sources: ["history:9"] }] },
      { sentences: [{ text: "The city reviewed it carefully.", sources: ["history:9"] }] },
    );
    const out = await runAgent("cameras", tools, { chat, verify: editor });
    expect(out.sentences).toEqual([]);
    expect(out.rejected).toBe(1);
  });
});
