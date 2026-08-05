import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RuntimeHealthBanner } from "./RuntimeHealthBanner";
import { useAppStore } from "../../state/appStore";
import type { RuntimeHealth } from "../../types/notebook";

vi.mock("../../ipc", () => ({
  listRecents: vi.fn(),
  removeRecent: vi.fn(),
  checkPhpRuntime: vi.fn(),
  pullPhpImage: vi.fn(),
}));

import { pullPhpImage } from "../../ipc";

const mockPull = vi.mocked(pullPhpImage);

const seed = (runtimeHealth: RuntimeHealth | null) => {
  useAppStore.setState({ runtimeHealth, pullingImage: false });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RuntimeHealthBanner", () => {
  it("renders nothing while healthy or unprobed", () => {
    seed({ status: "ok", detail: "ready", remedy: "" });
    const { container } = render(<RuntimeHealthBanner />);
    expect(container).toBeEmptyDOMElement();

    seed(null);
    const { container: unprobed } = render(<RuntimeHealthBanner />);
    expect(unprobed).toBeEmptyDOMElement();
  });

  it("shows detail and remedy for a stopped daemon without a pull action", () => {
    seed({
      status: "daemonNotRunning",
      detail: "The docker CLI exists but the daemon did not respond.",
      remedy: "Start Docker Desktop.",
    });
    render(<RuntimeHealthBanner />);
    expect(screen.getByText("Docker not running")).toBeInTheDocument();
    expect(screen.getByText(/daemon did not respond/)).toBeInTheDocument();
    expect(screen.getByText("Start Docker Desktop.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pull PHP image" })).toBeNull();
  });

  it("offers the pull action for a missing image and stores the fresh probe", async () => {
    const user = userEvent.setup();
    seed({ status: "imageMissing", detail: "image absent", remedy: "pull it" });
    mockPull.mockResolvedValue({ status: "ok", detail: "ready", remedy: "" });

    render(<RuntimeHealthBanner />);
    await user.click(screen.getByRole("button", { name: "Pull PHP image" }));

    expect(mockPull).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().runtimeHealth?.status).toBe("ok");
  });
});
