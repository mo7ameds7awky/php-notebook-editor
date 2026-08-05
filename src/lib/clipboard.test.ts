import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}));

import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const mockWrite = vi.mocked(writeText);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("copyText", () => {
  it("writes the exact text and reports success", async () => {
    mockWrite.mockResolvedValue(undefined);
    const result = await copyText('{"token":"secret-123"}');
    expect(mockWrite).toHaveBeenCalledWith('{"token":"secret-123"}');
    expect(result).toEqual({ ok: true });
  });

  it("reports failure without echoing the copied content", async () => {
    mockWrite.mockRejectedValue(new Error('denied while copying "secret-123"'));
    const result = await copyText("secret-123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).not.toContain("secret-123");
      expect(result.reason.length).toBeGreaterThan(5);
    }
  });

  it("never throws", async () => {
    mockWrite.mockRejectedValue("weird non-error rejection");
    await expect(copyText("x")).resolves.toMatchObject({ ok: false });
  });
});
