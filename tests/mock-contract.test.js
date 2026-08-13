// tests/mock-contract.test.js — Vitest contract test (Slice 4.4 commit 6)
// 验证 mock JSON 的 envelope 跟 backend response 一致.
// 跑: npx vitest run tests/mock-contract.test.js

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MOCK_DIR = resolve(__dirname, "../ai-tutor-frontend/assets/js/api/mock");

function loadMock(name) {
  const p = resolve(MOCK_DIR, name);
  return JSON.parse(readFileSync(p, "utf8"));
}

describe("mock vs backend envelope contract", () => {
  it("wrong_questions mock has required envelope", () => {
    const m = loadMock("wrong_questions.json");
    expect(m.success).toBe(true);
    expect(m).toHaveProperty("data");
    expect(Array.isArray(m.data)).toBe(true);
    expect(m.data.length).toBeGreaterThan(0);
    // pagination
    expect(m).toHaveProperty("pagination");
    expect(m.pagination).toHaveProperty("page");
    expect(m.pagination).toHaveProperty("total");
    // first item fields (keys the wrong-book.html cardTemplate reads)
    const row = m.data[0];
    expect(row).toHaveProperty("_id");
    expect(row).toHaveProperty("subject_code");
    expect(row).toHaveProperty("difficulty");
    expect(row).toHaveProperty("is_correct");
    expect(row.data).toHaveProperty("question");
  });

  it("wrong_create mock has success envelope", () => {
    const m = loadMock("wrong_create.json");
    expect(m.success).toBe(true);
    expect(m.data).toHaveProperty("id");
  });

  it("exam_papers mock returns array under data", () => {
    const m = loadMock("exam_papers.json");
    expect(m.success).toBe(true);
    expect(Array.isArray(m.data)).toBe(true);
    expect(m.data.length).toBeGreaterThan(0);
  });

  it("review_session_history mock returns array under data", () => {
    const m = loadMock("review_session_history.json");
    expect(m.success).toBe(true);
    expect(Array.isArray(m.data)).toBe(true);
  });
});