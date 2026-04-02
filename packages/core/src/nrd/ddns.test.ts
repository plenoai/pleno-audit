import { describe, it, expect } from "vitest";
import {
  checkDDNS,
  getDDNSProviderDomains,
  getDDNSProviderNames,
  DDNS_PROVIDERS,
} from "./ddns.js";

describe("DDNS_PROVIDERS", () => {
  it("contains known DDNS providers", () => {
    expect(DDNS_PROVIDERS.size).toBeGreaterThan(50);
  });

  it("includes No-IP domains", () => {
    expect(DDNS_PROVIDERS.get("no-ip.com")).toBe("No-IP");
    expect(DDNS_PROVIDERS.get("ddns.net")).toBe("No-IP");
    expect(DDNS_PROVIDERS.get("sytes.net")).toBe("No-IP");
  });

  it("includes DuckDNS", () => {
    expect(DDNS_PROVIDERS.get("duckdns.org")).toBe("DuckDNS");
  });

  it("includes DynDNS domains", () => {
    expect(DDNS_PROVIDERS.get("dyndns.org")).toBe("DynDNS");
    expect(DDNS_PROVIDERS.get("homelinux.com")).toBe("DynDNS");
  });

  it("includes FreeDNS domains", () => {
    expect(DDNS_PROVIDERS.get("afraid.org")).toBe("FreeDNS");
    expect(DDNS_PROVIDERS.get("mooo.com")).toBe("FreeDNS");
  });

  it("includes Synology domains", () => {
    expect(DDNS_PROVIDERS.get("synology.me")).toBe("Synology");
    expect(DDNS_PROVIDERS.get("myds.me")).toBe("Synology");
  });

  it("includes ngrok domains", () => {
    expect(DDNS_PROVIDERS.get("ngrok.io")).toBe("ngrok");
    expect(DDNS_PROVIDERS.get("ngrok.app")).toBe("ngrok");
  });
});

describe("checkDDNS", () => {
  describe("exact domain match", () => {
    it("detects DuckDNS domain", () => {
      const result = checkDDNS("duckdns.org");
      expect(result.isDDNS).toBe(true);
      expect(result.provider).toBe("DuckDNS");
      expect(result.matchedDomain).toBe("duckdns.org");
    });

    it("detects No-IP domain", () => {
      const result = checkDDNS("no-ip.com");
      expect(result.isDDNS).toBe(true);
      expect(result.provider).toBe("No-IP");
    });

    it("handles case insensitivity", () => {
      const result = checkDDNS("DUCKDNS.ORG");
      expect(result.isDDNS).toBe(true);
      expect(result.provider).toBe("DuckDNS");
    });
  });

  describe("subdomain match", () => {
    it("detects subdomain of DuckDNS", () => {
      const result = checkDDNS("myhost.duckdns.org");
      expect(result.isDDNS).toBe(true);
      expect(result.provider).toBe("DuckDNS");
      expect(result.matchedDomain).toBe("duckdns.org");
    });

    it("detects deep subdomain", () => {
      const result = checkDDNS("sub.host.duckdns.org");
      expect(result.isDDNS).toBe(true);
      expect(result.provider).toBe("DuckDNS");
    });

    it("detects No-IP subdomain", () => {
      const result = checkDDNS("myserver.ddns.net");
      expect(result.isDDNS).toBe(true);
      expect(result.provider).toBe("No-IP");
    });

    it("detects ngrok subdomain", () => {
      const result = checkDDNS("abc123.ngrok.io");
      expect(result.isDDNS).toBe(true);
      expect(result.provider).toBe("ngrok");
    });
  });

  describe("non-DDNS domains", () => {
    it("returns false for regular domain", () => {
      const result = checkDDNS("google.com");
      expect(result.isDDNS).toBe(false);
      expect(result.provider).toBeNull();
      expect(result.matchedDomain).toBeNull();
    });

    it("returns false for domain with similar name", () => {
      const result = checkDDNS("duckdns.com"); // Not .org
      expect(result.isDDNS).toBe(false);
    });

    it("returns false for partial match", () => {
      const result = checkDDNS("notduckdns.org");
      expect(result.isDDNS).toBe(false);
    });

    it("returns false for domain containing DDNS as substring", () => {
      const result = checkDDNS("myduckdnsclone.com");
      expect(result.isDDNS).toBe(false);
    });
  });

  describe("various DDNS providers", () => {
    const testCases = [
      { domain: "host.sytes.net", provider: "No-IP" },
      { domain: "host.hopto.org", provider: "No-IP" },
      { domain: "host.zapto.org", provider: "No-IP" },
      { domain: "host.dyndns.org", provider: "DynDNS" },
      { domain: "host.homelinux.org", provider: "DynDNS" },
      { domain: "host.dynu.com", provider: "Dynu" },
      { domain: "host.afraid.org", provider: "FreeDNS" },
      { domain: "host.changeip.com", provider: "ChangeIP" },
      { domain: "host.ydns.eu", provider: "YDNS" },
      { domain: "host.synology.me", provider: "Synology" },
      { domain: "host.myqnapcloud.com", provider: "QNAP" },
      { domain: "host.trycloudflare.com", provider: "Cloudflare" },
    ];

    testCases.forEach(({ domain, provider }) => {
      it(`detects ${provider} domain: ${domain}`, () => {
        const result = checkDDNS(domain);
        expect(result.isDDNS).toBe(true);
        expect(result.provider).toBe(provider);
      });
    });
  });
});

describe("getDDNSProviderDomains", () => {
  it("returns array of DDNS domains", () => {
    const domains = getDDNSProviderDomains();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBeGreaterThan(0);
  });

  it("includes known domains", () => {
    const domains = getDDNSProviderDomains();
    expect(domains).toContain("duckdns.org");
    expect(domains).toContain("no-ip.com");
    expect(domains).toContain("ngrok.io");
  });

  it("returns same count as DDNS_PROVIDERS", () => {
    const domains = getDDNSProviderDomains();
    expect(domains.length).toBe(DDNS_PROVIDERS.size);
  });
});

describe("getDDNSProviderNames", () => {
  it("returns array of provider names", () => {
    const names = getDDNSProviderNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
  });

  it("contains unique names", () => {
    const names = getDDNSProviderNames();
    const uniqueNames = [...new Set(names)];
    expect(names.length).toBe(uniqueNames.length);
  });

  it("includes major providers", () => {
    const names = getDDNSProviderNames();
    expect(names).toContain("No-IP");
    expect(names).toContain("DuckDNS");
    expect(names).toContain("DynDNS");
    expect(names).toContain("ngrok");
    expect(names).toContain("Synology");
  });
});
