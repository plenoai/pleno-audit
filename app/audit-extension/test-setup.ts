import "@testing-library/preact";
import { h } from "preact";
import { setupChromeMock } from "../../packages/test-utils/src/chrome-mock.js";
import { ThemeContext, lightColors } from "./lib/theme";

// Test wrapper with ThemeContext
export function TestWrapper({ children }: { children: preact.ComponentChildren }) {
  return h(ThemeContext.Provider, {
    value: {
      mode: "light",
      isDark: false,
      colors: lightColors,
      setMode: () => {},
    },
    children,
  });
}

// Mock chrome API for extension tests
setupChromeMock();

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
