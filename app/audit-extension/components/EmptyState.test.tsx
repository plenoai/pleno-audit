import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { EmptyState } from "./EmptyState";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

// Mock icon component for testing
function MockIcon({ size, style }: { size: number; style?: object }) {
  return h("svg", {
    "data-testid": "mock-icon",
    width: size,
    height: size,
    style,
  });
}

describe("EmptyState", () => {
  it("renders title", () => {
    renderWithTheme(h(EmptyState, { title: "No data found" }));
    expect(screen.getByText("No data found")).toBeTruthy();
  });

  it("renders description when provided", () => {
    renderWithTheme(
      h(EmptyState, {
        title: "No data",
        description: "There is no data to display",
      })
    );

    expect(screen.getByText("No data")).toBeTruthy();
    expect(screen.getByText("There is no data to display")).toBeTruthy();
  });

  it("does not render description when not provided", () => {
    const { container } = renderWithTheme(
      h(EmptyState, { title: "Empty" })
    );

    // Only the title div should exist inside the main container
    const mainDiv = container.querySelector("div");
    const innerDivs = mainDiv?.querySelectorAll("div");
    expect(innerDivs?.length).toBe(1); // Just the title div
  });

  it("renders action button when provided", () => {
    const onClick = () => {};
    renderWithTheme(
      h(EmptyState, {
        title: "No results",
        action: { label: "Reset filters", onClick },
      })
    );

    const button = screen.getByText("Reset filters");
    expect(button).toBeTruthy();
    expect(button.tagName).toBe("BUTTON");
  });

  it("does not render action button when not provided", () => {
    renderWithTheme(h(EmptyState, { title: "No items" }));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders icon when provided", () => {
    renderWithTheme(
      h(EmptyState, {
        title: "No items",
        icon: MockIcon,
      })
    );

    expect(screen.getByTestId("mock-icon")).toBeTruthy();
  });

  it("does not render icon when not provided", () => {
    renderWithTheme(h(EmptyState, { title: "No items" }));
    expect(screen.queryByTestId("mock-icon")).toBeNull();
  });

  it("passes correct size to icon", () => {
    renderWithTheme(
      h(EmptyState, {
        title: "No items",
        icon: MockIcon,
      })
    );

    const icon = screen.getByTestId("mock-icon");
    expect(icon.getAttribute("width")).toBe("48");
    expect(icon.getAttribute("height")).toBe("48");
  });

  it("has centered layout", () => {
    const { container } = renderWithTheme(
      h(EmptyState, { title: "Centered" })
    );

    const mainDiv = container.querySelector("div");
    expect(mainDiv?.style.display).toBe("flex");
    expect(mainDiv?.style.flexDirection).toBe("column");
    expect(mainDiv?.style.alignItems).toBe("center");
    expect(mainDiv?.style.justifyContent).toBe("center");
  });

  it("has correct padding", () => {
    const { container } = renderWithTheme(
      h(EmptyState, { title: "Padded" })
    );

    const mainDiv = container.querySelector("div");
    expect(mainDiv?.style.padding).toBe("48px");
  });
});
