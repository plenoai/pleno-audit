import { describe, expect, it } from "vitest";

import {
  DNR_RULE_CAPACITY,
  DNR_RULE_ID_BASE,
  DNR_RULE_ID_MAX,
} from "./constants.js";
import {
  buildDNRRuleSpec,
  findRuleIdByExtensionId,
  isMonitorRuleId,
  nextAvailableRuleId,
} from "./dnr-rules.js";

describe("isMonitorRuleId", () => {
  it("returns true for DNR_RULE_ID_BASE", () => {
    expect(isMonitorRuleId(DNR_RULE_ID_BASE)).toBe(true);
  });

  it("returns true for DNR_RULE_ID_MAX - 1", () => {
    expect(isMonitorRuleId(DNR_RULE_ID_MAX - 1)).toBe(true);
  });

  it("returns false for DNR_RULE_ID_MAX", () => {
    expect(isMonitorRuleId(DNR_RULE_ID_MAX)).toBe(false);
  });

  it("returns false for 0 and 9999", () => {
    expect(isMonitorRuleId(0)).toBe(false);
    expect(isMonitorRuleId(9999)).toBe(false);
  });
});

describe("buildDNRRuleSpec", () => {
  it("builds correct rule spec", () => {
    const spec = buildDNRRuleSpec("abcdefghijklmnopqrstuvwxyzabcdef", 10000, [
      "xmlhttprequest",
      "script",
    ]);

    expect(spec).toStrictEqual({
      id: 10000,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "x-pleno-observed", operation: "append", value: "1" },
        ],
      },
      condition: {
        initiatorDomains: ["abcdefghijklmnopqrstuvwxyzabcdef"],
        resourceTypes: ["xmlhttprequest", "script"],
      },
    });
  });

  it("uses provided resourceTypes", () => {
    const types = ["image", "sub_frame"];
    const spec = buildDNRRuleSpec("ext", 10001, types);

    expect(spec.condition.resourceTypes).toStrictEqual(types);
  });
});

describe("findRuleIdByExtensionId", () => {
  it("finds existing extensionId", () => {
    const ruleMap = new Map<number, string>([
      [10000, "ext-a"],
      [10001, "ext-b"],
    ]);

    expect(findRuleIdByExtensionId(ruleMap, "ext-b")).toBe(10001);
  });

  it("returns null for unknown extensionId", () => {
    const ruleMap = new Map<number, string>([[10000, "ext-a"]]);

    expect(findRuleIdByExtensionId(ruleMap, "ext-unknown")).toBeNull();
  });

  it("returns null for empty map", () => {
    const ruleMap = new Map<number, string>();

    expect(findRuleIdByExtensionId(ruleMap, "ext-a")).toBeNull();
  });
});

describe("nextAvailableRuleId", () => {
  it("returns DNR_RULE_ID_BASE for empty map", () => {
    const ruleMap = new Map<number, string>();

    expect(nextAvailableRuleId(ruleMap)).toBe(DNR_RULE_ID_BASE);
  });

  it("skips used IDs", () => {
    const ruleMap = new Map<number, string>([
      [10000, "ext-a"],
      [10001, "ext-b"],
    ]);

    expect(nextAvailableRuleId(ruleMap)).toBe(10002);
  });

  it("returns null when all slots used", () => {
    const ruleMap = new Map<number, string>();
    for (let i = 0; i < DNR_RULE_CAPACITY; i++) {
      ruleMap.set(DNR_RULE_ID_BASE + i, `ext-${String(i)}`);
    }

    expect(nextAvailableRuleId(ruleMap)).toBeNull();
  });
});
