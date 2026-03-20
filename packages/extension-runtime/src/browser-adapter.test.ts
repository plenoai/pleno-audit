/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createBrowserAdapter, browserAdapter } from "./browser-adapter.js";

describe("createBrowserAdapter", () => {
  let adapter: ReturnType<typeof createBrowserAdapter>;

  beforeEach(() => {
    adapter = createBrowserAdapter();
  });

  describe("querySelector", () => {
    it("returns element when found", () => {
      const div = document.createElement("div");
      div.id = "test-element";
      document.body.appendChild(div);

      const result = adapter.querySelector("#test-element");

      expect(result).toBe(div);
      document.body.removeChild(div);
    });

    it("returns null when element not found", () => {
      const result = adapter.querySelector("#non-existent");

      expect(result).toBeNull();
    });

    it("supports CSS selectors", () => {
      const div = document.createElement("div");
      div.className = "test-class";
      document.body.appendChild(div);

      const result = adapter.querySelector(".test-class");

      expect(result).toBe(div);
      document.body.removeChild(div);
    });
  });

  describe("querySelectorAll", () => {
    it("returns NodeList of matching elements", () => {
      const div1 = document.createElement("div");
      const div2 = document.createElement("div");
      div1.className = "multi-test";
      div2.className = "multi-test";
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      const result = adapter.querySelectorAll(".multi-test");

      expect(result.length).toBe(2);
      expect(result[0]).toBe(div1);
      expect(result[1]).toBe(div2);

      document.body.removeChild(div1);
      document.body.removeChild(div2);
    });

    it("returns empty NodeList when no matches", () => {
      const result = adapter.querySelectorAll(".non-existent-class");

      expect(result.length).toBe(0);
    });
  });

  describe("getLocation", () => {
    it("returns location object with origin", () => {
      const location = adapter.getLocation();

      expect(location.origin).toBeDefined();
      expect(typeof location.origin).toBe("string");
    });

    it("returns location object with pathname", () => {
      const location = adapter.getLocation();

      expect(location.pathname).toBeDefined();
      expect(typeof location.pathname).toBe("string");
    });

    it("returns location object with href", () => {
      const location = adapter.getLocation();

      expect(location.href).toBeDefined();
      expect(typeof location.href).toBe("string");
    });
  });
});

describe("browserAdapter", () => {
  it("is a pre-created adapter instance", () => {
    expect(browserAdapter).toBeDefined();
    expect(browserAdapter.querySelector).toBeDefined();
    expect(browserAdapter.querySelectorAll).toBeDefined();
    expect(browserAdapter.getLocation).toBeDefined();
  });

  it("has same interface as createBrowserAdapter result", () => {
    const adapter = createBrowserAdapter();

    expect(typeof browserAdapter.querySelector).toBe(typeof adapter.querySelector);
    expect(typeof browserAdapter.querySelectorAll).toBe(typeof adapter.querySelectorAll);
    expect(typeof browserAdapter.getLocation).toBe(typeof adapter.getLocation);
  });
});
