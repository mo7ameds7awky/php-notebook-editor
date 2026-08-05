import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "./appStore";

vi.mock("../ipc", () => ({
  listRecents: vi.fn(),
  removeRecent: vi.fn(),
  checkPhpRuntime: vi.fn(),
  pullPhpImage: vi.fn(),
}));

import { checkPhpRuntime, listRecents, pullPhpImage, removeRecent } from "../ipc";

const mockList = vi.mocked(listRecents);
const mockRemove = vi.mocked(removeRecent);
const mockCheck = vi.mocked(checkPhpRuntime);
const mockPull = vi.mocked(pullPhpImage);

const entry = (path: string) => ({
  path,
  title: "T",
  lastOpenedAt: "2026-08-03T10:00:00Z",
});

const okHealth = { status: "ok" as const, detail: "ready", remedy: "" };
const missingHealth = {
  status: "imageMissing" as const,
  detail: "image absent",
  remedy: "pull it",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    view: "home",
    recents: [],
    runtimeHealth: null,
    pullingImage: false,
  });
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

  it("refreshRuntimeHealth stores the probe result", async () => {
    mockCheck.mockResolvedValue(missingHealth);
    await useAppStore.getState().refreshRuntimeHealth();
    expect(useAppStore.getState().runtimeHealth).toEqual(missingHealth);
  });

  it("refreshRuntimeHealth keeps the previous state when the probe call fails", async () => {
    useAppStore.setState({ runtimeHealth: okHealth });
    mockCheck.mockRejectedValue(new Error("ipc down"));
    await useAppStore.getState().refreshRuntimeHealth();
    expect(useAppStore.getState().runtimeHealth).toEqual(okHealth);
  });

  it("pullImage flags progress and stores the fresh probe", async () => {
    let release!: (h: typeof okHealth) => void;
    mockPull.mockImplementation(() => new Promise((resolve) => (release = resolve)));

    const pending = useAppStore.getState().pullImage();
    expect(useAppStore.getState().pullingImage).toBe(true);

    release(okHealth);
    await pending;
    expect(useAppStore.getState().pullingImage).toBe(false);
    expect(useAppStore.getState().runtimeHealth).toEqual(okHealth);
  });

  it("pullImage clears the progress flag and rethrows on failure", async () => {
    mockPull.mockRejectedValue(new Error("pull failed"));
    await expect(useAppStore.getState().pullImage()).rejects.toThrow("pull failed");
    expect(useAppStore.getState().pullingImage).toBe(false);
  });
});
