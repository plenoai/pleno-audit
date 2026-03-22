import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { Badge } from "./Badge";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.ComponentChild) {
  return render(h(TestWrapper, { children: ui }));
}

describe("Badge", () => {
  it("renders children text", () => {
    renderWithTheme(h(Badge, {}, "Test Badge"));
    expect(screen.getByText("Test Badge")).toBeTruthy();
  });

  it("renders with default variant", () => {
    const { container } = renderWithTheme(h(Badge, {}, "Default"));
    const badge = container.querySelector("span");
    expect(badge).toBeTruthy();
  });

  it("renders with different variants", () => {
    const variants = ["success", "warning", "danger", "info"] as const;

    for (const variant of variants) {
      const { container, unmount } = renderWithTheme(
        h(Badge, { variant }, variant)
      );
      expect(container.querySelector("span")).toBeTruthy();
      unmount();
    }
  });

  it("renders as dot when dot prop is true", () => {
    const { container } = renderWithTheme(
      h(Badge, { dot: true }, "Dot Badge")
    );
    const dot = container.querySelector("span");
    expect(dot).toBeTruthy();
    // Dot should have width/height of 8px
    expect(dot?.style.width).toBe("8px");
    expect(dot?.style.height).toBe("8px");
    expect(dot?.style.borderRadius).toBe("50%");
  });

  it("applies size styles correctly", () => {
    // Small size (default)
    const { container: smContainer, unmount: unmountSm } = renderWithTheme(
      h(Badge, { size: "sm" }, "Small")
    );
    const smBadge = smContainer.querySelector("span");
    expect(smBadge?.style.fontSize).toBe("9px");
    unmountSm();

    // Medium size
    const { container: mdContainer } = renderWithTheme(
      h(Badge, { size: "md" }, "Medium")
    );
    const mdBadge = mdContainer.querySelector("span");
    expect(mdBadge?.style.fontSize).toBe("10px");
  });

  it("sets title attribute on dot badge", () => {
    const { container } = renderWithTheme(
      h(Badge, { dot: true }, "Tooltip Text")
    );
    const dot = container.querySelector("span");
    expect(dot?.getAttribute("title")).toBe("Tooltip Text");
  });

  it("applies pill border radius", () => {
    const { container } = renderWithTheme(h(Badge, {}, "Pill"));
    const badge = container.querySelector("span");
    expect(badge?.style.borderRadius).toBe("9999px");
  });
});
