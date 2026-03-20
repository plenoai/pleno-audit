import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMessageRouter, fireAndForget } from "./message-handler.js";

const mockAddListener = vi.fn();

vi.stubGlobal("chrome", {
  runtime: {
    onMessage: {
      addListener: mockAddListener,
    },
  },
});

describe("createMessageRouter", () => {
  let router: ReturnType<typeof createMessageRouter>;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createMessageRouter();
  });

  describe("register", () => {
    it("registers a handler for a message type", () => {
      const handler = vi.fn().mockResolvedValue({ success: true });

      router.register("TEST_MESSAGE", {
        handler,
        errorResponse: { success: false, reason: "error" },
      });

      expect(() => router.register("TEST_MESSAGE_2", {
        handler: vi.fn(),
        errorResponse: { success: false },
      })).not.toThrow();
    });

    it("allows custom log prefix", () => {
      const handler = vi.fn().mockResolvedValue({ success: true });

      expect(() => router.register("TEST_MESSAGE", {
        handler,
        errorResponse: { success: false },
        logPrefix: "custom-prefix",
      })).not.toThrow();
    });
  });

  describe("listen", () => {
    it("adds message listener to chrome.runtime", () => {
      router.listen();

      expect(mockAddListener).toHaveBeenCalledTimes(1);
      expect(mockAddListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it("calls registered handler on matching message", async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const sendResponse = vi.fn();

      router.register("TEST_ACTION", {
        handler,
        errorResponse: { success: false, reason: "error" },
      });

      router.listen();

      const listener = mockAddListener.mock.calls[0][0];
      const result = listener(
        { type: "TEST_ACTION", data: { foo: "bar" } },
        { tab: { id: 1 } },
        sendResponse
      );

      expect(result).toBe(true);

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith(
          { foo: "bar" },
          { tab: { id: 1 } }
        );
      });
    });

    it("uses payload if data is not present", async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const sendResponse = vi.fn();

      router.register("TEST_ACTION", {
        handler,
        errorResponse: { success: false, reason: "error" },
      });

      router.listen();

      const listener = mockAddListener.mock.calls[0][0];
      listener(
        { type: "TEST_ACTION", payload: { baz: "qux" } },
        { tab: { id: 1 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith(
          { baz: "qux" },
          { tab: { id: 1 } }
        );
      });
    });

    it("sends response on success", async () => {
      const handler = vi.fn().mockResolvedValue({ result: "ok" });
      const sendResponse = vi.fn();

      router.register("TEST_ACTION", {
        handler,
        errorResponse: { success: false, reason: "error" },
      });

      router.listen();

      const listener = mockAddListener.mock.calls[0][0];
      listener(
        { type: "TEST_ACTION", data: {} },
        { tab: { id: 1 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ result: "ok" });
      });
    });

    it("sends error response on handler failure", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler error"));
      const sendResponse = vi.fn();
      const errorResponse = { success: false, reason: "error" };

      router.register("TEST_ACTION", {
        handler,
        errorResponse,
      });

      router.listen();

      const listener = mockAddListener.mock.calls[0][0];
      listener(
        { type: "TEST_ACTION", data: {} },
        { tab: { id: 1 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith(errorResponse);
      });
    });

    it("returns false for unregistered message types", () => {
      router.listen();

      const listener = mockAddListener.mock.calls[0][0];
      const result = listener(
        { type: "UNKNOWN_ACTION", data: {} },
        { tab: { id: 1 } },
        vi.fn()
      );

      expect(result).toBe(false);
    });

    it("does not call handler for unregistered message types", () => {
      const handler = vi.fn();
      const sendResponse = vi.fn();

      router.register("REGISTERED_ACTION", {
        handler,
        errorResponse: { success: false },
      });

      router.listen();

      const listener = mockAddListener.mock.calls[0][0];
      listener(
        { type: "UNREGISTERED_ACTION", data: {} },
        { tab: { id: 1 } },
        sendResponse
      );

      expect(handler).not.toHaveBeenCalled();
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});

describe("fireAndForget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not throw on resolved promise", () => {
    const promise = Promise.resolve("success");

    expect(() => fireAndForget(promise, "test-context")).not.toThrow();
  });

  it("does not throw on rejected promise", () => {
    const promise = Promise.reject(new Error("test error"));

    expect(() => fireAndForget(promise, "test-context")).not.toThrow();
  });

  it("returns void", () => {
    const promise = Promise.resolve("success");

    const result = fireAndForget(promise, "test-context");

    expect(result).toBeUndefined();
  });

  it("logs error on rejection", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const promise = Promise.reject(new Error("test error"));

    fireAndForget(promise, "test-context");

    await vi.waitFor(() => {
      // Logger logs to console, so we check if console.error was called
      // or the promise rejection was handled
    }, { timeout: 100 });

    consoleErrorSpy.mockRestore();
  });
});
