import { describe, expect, it } from "vitest";
import { TOPICS, topicOfBody, topicOfFile } from "../../../lib/topics";

describe("topicOfBody", () => {
  it("maps each synced committee and commission to its topic, ignoring case and spacing", () => {
    expect(topicOfBody("FINANCE & PERSONNEL COMMITTEE")).toBe("budget");
    expect(topicOfBody(" Public Safety and Health Committee ")).toBe("safety");
    expect(topicOfBody("FIRE AND POLICE COMMISSION")).toBe("safety");
    expect(topicOfBody("LICENSES COMMITTEE")).toBe("licenses");
    expect(topicOfBody("PUBLIC WORKS COMMITTEE")).toBe("streets");
    expect(topicOfBody("ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE")).toBe("development");
    expect(topicOfBody("CITY PLAN COMMISSION")).toBe("development");
    expect(topicOfBody("HISTORIC PRESERVATION COMMISSION")).toBe("development");
    expect(topicOfBody("COMMUNITY & ECONOMIC DEVELOPMENT COMMITTEE")).toBe("economy");
    expect(topicOfBody("JUDICIARY & LEGISLATION COMMITTEE")).toBe("laws");
    expect(topicOfBody("STEERING & RULES COMMITTEE")).toBe("council");
  });

  it("gives no topic to the Council, the Mayor or unknown bodies, so a file takes its committee's topic", () => {
    expect(topicOfBody("COMMON COUNCIL")).toBeUndefined();
    expect(topicOfBody("MAYOR")).toBeUndefined();
    expect(topicOfBody("SISTER CITIES COMMITTEE")).toBeUndefined();
  });
});

describe("topicOfFile", () => {
  it("takes the topic of the first committee in the file's history", () => {
    expect(topicOfFile(["COMMON COUNCIL", "FINANCE & PERSONNEL COMMITTEE", "COMMON COUNCIL", "MAYOR"])).toBe("budget");
    expect(topicOfFile(["CITY PLAN COMMISSION", "ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE"])).toBe("development");
  });

  it("falls back to Council business for a file that only went through the Council", () => {
    expect(topicOfFile(["COMMON COUNCIL", "MAYOR"])).toBe("council");
    expect(topicOfFile([])).toBe("council");
  });

  it("has a plain label for every topic id", () => {
    for (const t of Object.keys(TOPICS)) expect(TOPICS[t as keyof typeof TOPICS]).toMatch(/^[A-Z][a-z]/);
  });
});
