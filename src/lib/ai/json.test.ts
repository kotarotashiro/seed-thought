import { describe, it, expect } from "vitest";
import { AiJsonError, parseAiJson, tryParseAiJson } from "./json";

const isString = (v: unknown): v is string => typeof v === "string";
const isNumObj = (v: unknown): v is { n: number } =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Record<string, unknown>).n === "number";

describe("parseAiJson", () => {
  it("parses plain JSON string", () => {
    expect(parseAiJson('"hello"', isString, "test")).toBe("hello");
  });

  it("parses plain JSON object", () => {
    expect(parseAiJson('{"n":42}', isNumObj, "test")).toEqual({ n: 42 });
  });

  it("strips ```json fenced code block", () => {
    const fenced = '```json\n{"n":1}\n```';
    expect(parseAiJson(fenced, isNumObj, "test")).toEqual({ n: 1 });
  });

  it("strips plain ``` fenced block", () => {
    const fenced = '```\n{"n":2}\n```';
    expect(parseAiJson(fenced, isNumObj, "test")).toEqual({ n: 2 });
  });

  it("throws AiJsonError on empty input", () => {
    expect(() => parseAiJson("", isString, "lbl")).toThrow(AiJsonError);
    expect(() => parseAiJson("   ", isString, "lbl")).toThrow(AiJsonError);
  });

  it("throws AiJsonError on malformed JSON", () => {
    expect(() => parseAiJson("{bad json}", isString, "lbl")).toThrow(AiJsonError);
  });

  it("throws AiJsonError when validator rejects value", () => {
    expect(() => parseAiJson('"hello"', isNumObj, "lbl")).toThrow(AiJsonError);
  });

  it("throws AiJsonError not generic Error on validation failure", () => {
    try {
      parseAiJson('"x"', isNumObj, "myLabel");
    } catch (e) {
      expect(e).toBeInstanceOf(AiJsonError);
    }
  });
});

describe("tryParseAiJson", () => {
  it("returns parsed value on success", () => {
    expect(tryParseAiJson('{"n":7}', isNumObj, "test")).toEqual({ n: 7 });
  });

  it("returns null on invalid JSON", () => {
    expect(tryParseAiJson("{broken}", isNumObj, "test")).toBeNull();
  });

  it("returns null on validation failure", () => {
    expect(tryParseAiJson('"not-an-obj"', isNumObj, "test")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(tryParseAiJson("", isString, "test")).toBeNull();
  });
});
