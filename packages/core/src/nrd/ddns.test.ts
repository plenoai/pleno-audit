import { describe, it, expect } from "vitest";
import {
  checkDDNS,
  getDDNSProviderDomains,
  getDDNSProviderNames,
  DDNS_PROVIDERS,
} from "./ddns.js";

describe("DDNS_PROVIDERS", () => {
  it("has exactly the expected number of entries", () => {
    expect(DDNS_PROVIDERS.size).toBe(119);
  });

  // Verify EVERY entry in the Map to kill string mutations on both keys and values
  const allEntries: [string, string][] = [
    // No-IP
    ["no-ip.com", "No-IP"],
    ["no-ip.org", "No-IP"],
    ["no-ip.biz", "No-IP"],
    ["noip.com", "No-IP"],
    ["ddns.net", "No-IP"],
    ["serveftp.com", "No-IP"],
    ["servequake.com", "No-IP"],
    ["sytes.net", "No-IP"],
    ["zapto.org", "No-IP"],
    ["hopto.org", "No-IP"],
    ["redirectme.net", "No-IP"],
    ["bounceme.net", "No-IP"],
    ["myftp.biz", "No-IP"],
    ["myftp.org", "No-IP"],
    ["myvnc.com", "No-IP"],
    ["serveblog.net", "No-IP"],
    ["servebeer.com", "No-IP"],
    ["servegame.com", "No-IP"],
    ["servehalflife.com", "No-IP"],
    ["servehttp.com", "No-IP"],
    ["serveirc.com", "No-IP"],
    ["servemp3.com", "No-IP"],
    ["servepics.com", "No-IP"],

    // DuckDNS
    ["duckdns.org", "DuckDNS"],

    // DynDNS
    ["dyndns.org", "DynDNS"],
    ["dyndns.biz", "DynDNS"],
    ["dyndns.info", "DynDNS"],
    ["dyndns.tv", "DynDNS"],
    ["dyndns.ws", "DynDNS"],
    ["dynalias.com", "DynDNS"],
    ["dynalias.net", "DynDNS"],
    ["dynalias.org", "DynDNS"],
    ["homeip.net", "DynDNS"],
    ["homelinux.com", "DynDNS"],
    ["homelinux.net", "DynDNS"],
    ["homelinux.org", "DynDNS"],
    ["homeunix.com", "DynDNS"],
    ["homeunix.net", "DynDNS"],
    ["homeunix.org", "DynDNS"],
    ["dnsalias.com", "DynDNS"],
    ["dnsalias.net", "DynDNS"],
    ["dnsalias.org", "DynDNS"],
    ["dnsdojo.com", "DynDNS"],
    ["dnsdojo.net", "DynDNS"],
    ["dnsdojo.org", "DynDNS"],
    ["is-a-geek.com", "DynDNS"],
    ["is-a-geek.net", "DynDNS"],
    ["is-a-geek.org", "DynDNS"],

    // Dynu
    ["dynu.com", "Dynu"],
    ["dynu.net", "Dynu"],
    ["accesscam.org", "Dynu"],
    ["camdvr.org", "Dynu"],
    ["freeddns.org", "Dynu"],
    ["mywire.org", "Dynu"],
    ["webredirect.org", "Dynu"],
    ["myddns.rocks", "Dynu"],
    ["blogsite.xyz", "Dynu"],

    // FreeDNS
    ["afraid.org", "FreeDNS"],
    ["chickenkiller.com", "FreeDNS"],
    ["crabdance.com", "FreeDNS"],
    ["ignorelist.com", "FreeDNS"],
    ["jumpingcrab.com", "FreeDNS"],
    ["mooo.com", "FreeDNS"],
    ["strangled.net", "FreeDNS"],
    ["twilightparadox.com", "FreeDNS"],
    ["us.to", "FreeDNS"],

    // ChangeIP
    ["changeip.com", "ChangeIP"],
    ["changeip.net", "ChangeIP"],
    ["changeip.org", "ChangeIP"],
    ["dns-dns.com", "ChangeIP"],
    ["dns04.com", "ChangeIP"],
    ["dns05.com", "ChangeIP"],
    ["dnsrd.com", "ChangeIP"],
    ["got-game.org", "ChangeIP"],
    ["onmypc.biz", "ChangeIP"],
    ["onmypc.info", "ChangeIP"],
    ["onmypc.net", "ChangeIP"],
    ["onmypc.org", "ChangeIP"],
    ["onmypc.us", "ChangeIP"],
    ["ygto.com", "ChangeIP"],

    // DNS Exit
    ["dnsexit.com", "DNS Exit"],
    ["dnsexit.net", "DNS Exit"],
    ["linkpc.net", "DNS Exit"],
    ["publicvm.com", "DNS Exit"],
    ["online.tm", "DNS Exit"],

    // YDNS
    ["ydns.eu", "YDNS"],

    // nsupdate.info
    ["nsupdate.info", "nsupdate.info"],

    // Securepoint
    ["spdns.de", "Securepoint"],
    ["spdns.eu", "Securepoint"],
    ["spdns.org", "Securepoint"],

    // Other
    ["3utilities.com", "Other"],
    ["ddnsking.com", "Other"],
    ["gotdns.ch", "Other"],
    ["kozow.com", "Other"],
    ["loseyourip.com", "Other"],
    ["ooguy.com", "Other"],
    ["theworkpc.com", "Other"],
    ["casacam.net", "Other"],
    ["mynetav.net", "Other"],
    ["mynetav.org", "Other"],
    ["my-vigor.de", "Other"],
    ["syn-alias.com", "Other"],
    ["synology-ds.de", "Other"],
    ["synology-diskstation.de", "Other"],

    // Synology
    ["synology.me", "Synology"],
    ["diskstation.me", "Synology"],
    ["dscloud.biz", "Synology"],
    ["dscloud.me", "Synology"],
    ["dscloud.mobi", "Synology"],
    ["i234.me", "Synology"],
    ["myds.me", "Synology"],
    ["quickconnect.cn", "Synology"],
    ["quickconnect.to", "Synology"],

    // QNAP
    ["myqnapcloud.com", "QNAP"],
    ["qnapcloud.com", "QNAP"],

    // Cloudflare
    ["trycloudflare.com", "Cloudflare"],

    // ngrok
    ["ngrok.io", "ngrok"],
    ["ngrok-free.app", "ngrok"],
    ["ngrok.app", "ngrok"],
  ];

  it.each(allEntries)(
    "maps '%s' to provider '%s'",
    (domain, provider) => {
      expect(DDNS_PROVIDERS.get(domain)).toBe(provider);
    },
  );
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

    it("handles mixed case", () => {
      const result = checkDDNS("DuckDNS.Org");
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

    it("returns false for empty string", () => {
      const result = checkDDNS("");
      expect(result.isDDNS).toBe(false);
      expect(result.provider).toBeNull();
      expect(result.matchedDomain).toBeNull();
    });
  });

  // Test checkDDNS with a subdomain for EVERY provider domain to kill key string mutations
  describe("subdomain detection for every DDNS provider domain", () => {
    const allDomains: [string, string][] = [
      // No-IP
      ["no-ip.com", "No-IP"],
      ["no-ip.org", "No-IP"],
      ["no-ip.biz", "No-IP"],
      ["noip.com", "No-IP"],
      ["ddns.net", "No-IP"],
      ["serveftp.com", "No-IP"],
      ["servequake.com", "No-IP"],
      ["sytes.net", "No-IP"],
      ["zapto.org", "No-IP"],
      ["hopto.org", "No-IP"],
      ["redirectme.net", "No-IP"],
      ["bounceme.net", "No-IP"],
      ["myftp.biz", "No-IP"],
      ["myftp.org", "No-IP"],
      ["myvnc.com", "No-IP"],
      ["serveblog.net", "No-IP"],
      ["servebeer.com", "No-IP"],
      ["servegame.com", "No-IP"],
      ["servehalflife.com", "No-IP"],
      ["servehttp.com", "No-IP"],
      ["serveirc.com", "No-IP"],
      ["servemp3.com", "No-IP"],
      ["servepics.com", "No-IP"],

      // DuckDNS
      ["duckdns.org", "DuckDNS"],

      // DynDNS
      ["dyndns.org", "DynDNS"],
      ["dyndns.biz", "DynDNS"],
      ["dyndns.info", "DynDNS"],
      ["dyndns.tv", "DynDNS"],
      ["dyndns.ws", "DynDNS"],
      ["dynalias.com", "DynDNS"],
      ["dynalias.net", "DynDNS"],
      ["dynalias.org", "DynDNS"],
      ["homeip.net", "DynDNS"],
      ["homelinux.com", "DynDNS"],
      ["homelinux.net", "DynDNS"],
      ["homelinux.org", "DynDNS"],
      ["homeunix.com", "DynDNS"],
      ["homeunix.net", "DynDNS"],
      ["homeunix.org", "DynDNS"],
      ["dnsalias.com", "DynDNS"],
      ["dnsalias.net", "DynDNS"],
      ["dnsalias.org", "DynDNS"],
      ["dnsdojo.com", "DynDNS"],
      ["dnsdojo.net", "DynDNS"],
      ["dnsdojo.org", "DynDNS"],
      ["is-a-geek.com", "DynDNS"],
      ["is-a-geek.net", "DynDNS"],
      ["is-a-geek.org", "DynDNS"],

      // Dynu
      ["dynu.com", "Dynu"],
      ["dynu.net", "Dynu"],
      ["accesscam.org", "Dynu"],
      ["camdvr.org", "Dynu"],
      ["freeddns.org", "Dynu"],
      ["mywire.org", "Dynu"],
      ["webredirect.org", "Dynu"],
      ["myddns.rocks", "Dynu"],
      ["blogsite.xyz", "Dynu"],

      // FreeDNS
      ["afraid.org", "FreeDNS"],
      ["chickenkiller.com", "FreeDNS"],
      ["crabdance.com", "FreeDNS"],
      ["ignorelist.com", "FreeDNS"],
      ["jumpingcrab.com", "FreeDNS"],
      ["mooo.com", "FreeDNS"],
      ["strangled.net", "FreeDNS"],
      ["twilightparadox.com", "FreeDNS"],
      ["us.to", "FreeDNS"],

      // ChangeIP
      ["changeip.com", "ChangeIP"],
      ["changeip.net", "ChangeIP"],
      ["changeip.org", "ChangeIP"],
      ["dns-dns.com", "ChangeIP"],
      ["dns04.com", "ChangeIP"],
      ["dns05.com", "ChangeIP"],
      ["dnsrd.com", "ChangeIP"],
      ["got-game.org", "ChangeIP"],
      ["onmypc.biz", "ChangeIP"],
      ["onmypc.info", "ChangeIP"],
      ["onmypc.net", "ChangeIP"],
      ["onmypc.org", "ChangeIP"],
      ["onmypc.us", "ChangeIP"],
      ["ygto.com", "ChangeIP"],

      // DNS Exit
      ["dnsexit.com", "DNS Exit"],
      ["dnsexit.net", "DNS Exit"],
      ["linkpc.net", "DNS Exit"],
      ["publicvm.com", "DNS Exit"],
      ["online.tm", "DNS Exit"],

      // YDNS
      ["ydns.eu", "YDNS"],

      // nsupdate.info
      ["nsupdate.info", "nsupdate.info"],

      // Securepoint
      ["spdns.de", "Securepoint"],
      ["spdns.eu", "Securepoint"],
      ["spdns.org", "Securepoint"],

      // Other
      ["3utilities.com", "Other"],
      ["ddnsking.com", "Other"],
      ["gotdns.ch", "Other"],
      ["kozow.com", "Other"],
      ["loseyourip.com", "Other"],
      ["ooguy.com", "Other"],
      ["theworkpc.com", "Other"],
      ["casacam.net", "Other"],
      ["mynetav.net", "Other"],
      ["mynetav.org", "Other"],
      ["my-vigor.de", "Other"],
      ["syn-alias.com", "Other"],
      ["synology-ds.de", "Other"],
      ["synology-diskstation.de", "Other"],

      // Synology
      ["synology.me", "Synology"],
      ["diskstation.me", "Synology"],
      ["dscloud.biz", "Synology"],
      ["dscloud.me", "Synology"],
      ["dscloud.mobi", "Synology"],
      ["i234.me", "Synology"],
      ["myds.me", "Synology"],
      ["quickconnect.cn", "Synology"],
      ["quickconnect.to", "Synology"],

      // QNAP
      ["myqnapcloud.com", "QNAP"],
      ["qnapcloud.com", "QNAP"],

      // Cloudflare
      ["trycloudflare.com", "Cloudflare"],

      // ngrok
      ["ngrok.io", "ngrok"],
      ["ngrok-free.app", "ngrok"],
      ["ngrok.app", "ngrok"],
    ];

    it.each(allDomains)(
      "detects subdomain of %s as %s",
      (ddnsDomain, provider) => {
        const result = checkDDNS(`test.${ddnsDomain}`);
        expect(result.isDDNS).toBe(true);
        expect(result.provider).toBe(provider);
        expect(result.matchedDomain).toBe(ddnsDomain);
      },
    );
  });
});

describe("getDDNSProviderDomains", () => {
  it("returns array of DDNS domains", () => {
    const domains = getDDNSProviderDomains();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBe(119);
  });

  it("returns same count as DDNS_PROVIDERS", () => {
    const domains = getDDNSProviderDomains();
    expect(domains.length).toBe(DDNS_PROVIDERS.size);
  });

  it("contains every known DDNS domain", () => {
    const domains = getDDNSProviderDomains();
    // Spot-check domains from each provider group
    expect(domains).toContain("no-ip.com");
    expect(domains).toContain("noip.com");
    expect(domains).toContain("serveftp.com");
    expect(domains).toContain("sytes.net");
    expect(domains).toContain("duckdns.org");
    expect(domains).toContain("dyndns.org");
    expect(domains).toContain("homelinux.com");
    expect(domains).toContain("is-a-geek.com");
    expect(domains).toContain("dynu.com");
    expect(domains).toContain("blogsite.xyz");
    expect(domains).toContain("afraid.org");
    expect(domains).toContain("mooo.com");
    expect(domains).toContain("us.to");
    expect(domains).toContain("changeip.com");
    expect(domains).toContain("ygto.com");
    expect(domains).toContain("dnsexit.com");
    expect(domains).toContain("linkpc.net");
    expect(domains).toContain("online.tm");
    expect(domains).toContain("ydns.eu");
    expect(domains).toContain("nsupdate.info");
    expect(domains).toContain("spdns.de");
    expect(domains).toContain("3utilities.com");
    expect(domains).toContain("synology-diskstation.de");
    expect(domains).toContain("synology.me");
    expect(domains).toContain("quickconnect.to");
    expect(domains).toContain("myqnapcloud.com");
    expect(domains).toContain("trycloudflare.com");
    expect(domains).toContain("ngrok.io");
    expect(domains).toContain("ngrok-free.app");
    expect(domains).toContain("ngrok.app");
  });
});

describe("getDDNSProviderNames", () => {
  it("returns array of unique provider names", () => {
    const names = getDDNSProviderNames();
    expect(Array.isArray(names)).toBe(true);
    const uniqueNames = [...new Set(names)];
    expect(names.length).toBe(uniqueNames.length);
  });

  it("returns exactly the expected number of unique providers", () => {
    const names = getDDNSProviderNames();
    expect(names.length).toBe(15);
  });

  it("includes all provider names", () => {
    const names = getDDNSProviderNames();
    expect(names).toContain("No-IP");
    expect(names).toContain("DuckDNS");
    expect(names).toContain("DynDNS");
    expect(names).toContain("Dynu");
    expect(names).toContain("FreeDNS");
    expect(names).toContain("ChangeIP");
    expect(names).toContain("DNS Exit");
    expect(names).toContain("YDNS");
    expect(names).toContain("nsupdate.info");
    expect(names).toContain("Securepoint");
    expect(names).toContain("Other");
    expect(names).toContain("Synology");
    expect(names).toContain("QNAP");
    expect(names).toContain("Cloudflare");
    expect(names).toContain("ngrok");
  });
});
