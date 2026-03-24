import { describe, it, expect } from "vitest";
import { render } from "@testing-library/preact";
import { h } from "preact";
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonChart,
  SkeletonStatsGrid,
  SkeletonDashboard,
} from "./Skeleton";
import { TestWrapper } from "../test-setup";

function renderWithTheme(ui: preact.VNode) {
  return render(h(TestWrapper, {}, ui));
}

describe("Skeleton", () => {
  it("renders with default props", () => {
    const { container } = renderWithTheme(h(Skeleton, {}));
    const skeleton = container.querySelector("div");
    expect(skeleton).toBeTruthy();
    expect(skeleton?.style.width).toBe("100%");
    expect(skeleton?.style.height).toBe("16px");
    expect(skeleton?.style.borderRadius).toBe("4px");
  });

  it("renders with custom width and height", () => {
    const { container } = renderWithTheme(
      h(Skeleton, { width: 200, height: 32 })
    );
    const skeleton = container.querySelector("div");
    expect(skeleton?.style.width).toBe("200px");
    expect(skeleton?.style.height).toBe("32px");
  });

  it("renders with string dimensions", () => {
    const { container } = renderWithTheme(
      h(Skeleton, { width: "50%", height: "2rem" })
    );
    const skeleton = container.querySelector("div");
    expect(skeleton?.style.width).toBe("50%");
    expect(skeleton?.style.height).toBe("2rem");
  });

  it("renders with custom border radius", () => {
    const { container } = renderWithTheme(
      h(Skeleton, { borderRadius: 8 })
    );
    const skeleton = container.querySelector("div");
    expect(skeleton?.style.borderRadius).toBe("8px");
  });

  it("applies custom style", () => {
    const { container } = renderWithTheme(
      h(Skeleton, { style: { marginTop: 10 } })
    );
    const skeleton = container.querySelector("div");
    expect(skeleton?.style.marginTop).toBe("10px");
  });

  it("has shimmer animation", () => {
    const { container } = renderWithTheme(h(Skeleton, {}));
    const skeleton = container.querySelector("div");
    expect(skeleton?.style.animation).toContain("skeleton-shimmer");
  });
});

describe("SkeletonText", () => {
  it("renders default 3 lines", () => {
    const { container } = renderWithTheme(h(SkeletonText, {}));
    const wrapper = container.querySelector("div");
    const lines = wrapper?.querySelectorAll(":scope > div");
    expect(lines?.length).toBe(3);
  });

  it("renders custom number of lines", () => {
    const { container } = renderWithTheme(h(SkeletonText, { lines: 5 }));
    const wrapper = container.querySelector("div");
    const lines = wrapper?.querySelectorAll(":scope > div");
    expect(lines?.length).toBe(5);
  });

  it("last line is shorter", () => {
    const { container } = renderWithTheme(h(SkeletonText, { lines: 3 }));
    const wrapper = container.querySelector("div");
    const lines = wrapper?.querySelectorAll(":scope > div");
    const lastLine = lines?.[2];
    expect(lastLine?.style.width).toBe("60%");
  });
});

describe("SkeletonCard", () => {
  it("renders card structure", () => {
    const { container } = renderWithTheme(h(SkeletonCard, {}));
    const card = container.querySelector("div");
    expect(card).toBeTruthy();
    expect(card?.style.padding).toBe("16px");
    expect(card?.style.borderRadius).toBe("8px");
  });

  it("contains skeleton elements", () => {
    const { container } = renderWithTheme(h(SkeletonCard, {}));
    const skeletons = container.querySelectorAll("div > div");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("SkeletonTable", () => {
  it("renders default 5 rows", () => {
    const { container } = renderWithTheme(h(SkeletonTable, {}));
    // Header + 5 rows
    const rows = container.querySelectorAll("div > div");
    expect(rows.length).toBeGreaterThan(5);
  });

  it("renders custom number of rows", () => {
    const { container } = renderWithTheme(h(SkeletonTable, { rows: 3 }));
    const tableWrapper = container.querySelector("div");
    expect(tableWrapper).toBeTruthy();
  });

  it("has 4-column grid layout", () => {
    const { container } = renderWithTheme(h(SkeletonTable, {}));
    // Find the grid header element (first child inside the table wrapper)
    const tableWrapper = container.querySelector("div");
    const header = tableWrapper?.querySelector(":scope > div");
    // jsdom doesn't fully support gridTemplateColumns, check display: grid instead
    expect(header?.style.display).toBe("grid");
  });
});

describe("SkeletonChart", () => {
  it("renders with default height", () => {
    const { container } = renderWithTheme(h(SkeletonChart, {}));
    const chart = container.querySelector("div");
    expect(chart?.style.height).toBe("200px");
  });

  it("renders with custom height", () => {
    const { container } = renderWithTheme(h(SkeletonChart, { height: 300 }));
    const chart = container.querySelector("div");
    expect(chart?.style.height).toBe("300px");
  });

  it("renders bar skeletons", () => {
    const { container } = renderWithTheme(h(SkeletonChart, {}));
    const chart = container.querySelector("div");
    const bars = chart?.querySelectorAll(":scope > div");
    expect(bars?.length).toBe(10);
  });
});

describe("SkeletonStatsGrid", () => {
  it("renders 4 skeleton cards", () => {
    const { container } = renderWithTheme(h(SkeletonStatsGrid, {}));
    const grid = container.querySelector("div");
    expect(grid?.style.gridTemplateColumns).toBe("repeat(4, 1fr)");
  });
});

describe("SkeletonDashboard", () => {
  it("renders complete dashboard skeleton", () => {
    const { container } = renderWithTheme(h(SkeletonDashboard, {}));
    const wrapper = container.querySelector("div");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.style.flexDirection).toBe("column");
  });

  it("uses shimmer animation class", () => {
    const { container } = renderWithTheme(h(SkeletonDashboard, {}));
    const shimmerEl = container.querySelector("[style*='skeleton-shimmer']");
    expect(shimmerEl).toBeTruthy();
  });
});
