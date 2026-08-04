import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "./appStore";

vi.mock("../ipc", () => ({
  listRecents: vi.fn(),
  removeRecent: vi.fn(),
}));

import { listRecents, removeRecent } from "../ipc";

const mockList = vi.mocked(listRecents);
const mockRemove = vi.mocked(removeRecent);

const entry = (path: string) => ({
  path,
  title: "T",
  lastOpenedAt: "2026-08-03T10:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ view: "home", recents: [] });
});

describe("appStore", () => {
  it("switches views", () => {
    useAppStore.getState().setView("notebook");
    expect(useAppStore.getState().view).toBe("notebook");
  });

  it("refreshRecents loads entries", async () => {
    mockList.mockResolvedValue({ entries: [entry("/a.pnb.json")] });
    await useAppStore.getState().refreshRecents();
    expect(useAppStore.getState().recents).toHaveLength(1);
  });

  it("removeRecentEntry replaces the list with the backend result", async () => {
    mockRemove.mockResolvedValue({ entries: [] });
    useAppStore.setState({ recents: [entry("/a.pnb.json")] });
    await useAppStore.getState().removeRecentEntry("/a.pnb.json");
    expect(mockRemove).toHaveBeenCalledWith("/a.pnb.json");
    expect(useAppStore.getState().recents).toHaveLength(0);
  });
});
