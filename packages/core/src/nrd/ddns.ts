/**
 * DDNS (Dynamic DNS) Detection
 *
 * Detects domains using Dynamic DNS services.
 * DDNS is commonly abused for malware C2, phishing, and other malicious purposes
 * because it allows attackers to quickly change IP addresses.
 */

/**
 * Known DDNS provider domains
 * These are legitimate services but frequently abused for malicious purposes
 */
export const DDNS_PROVIDERS: ReadonlyMap<string, string> = new Map([
  // No-IP
  ['no-ip.com', 'No-IP'],
  ['no-ip.org', 'No-IP'],
  ['no-ip.biz', 'No-IP'],
  ['noip.com', 'No-IP'],
  ['ddns.net', 'No-IP'],
  ['serveftp.com', 'No-IP'],
  ['servequake.com', 'No-IP'],
  ['sytes.net', 'No-IP'],
  ['zapto.org', 'No-IP'],
  ['hopto.org', 'No-IP'],
  ['redirectme.net', 'No-IP'],
  ['bounceme.net', 'No-IP'],
  ['myftp.biz', 'No-IP'],
  ['myftp.org', 'No-IP'],
  ['myvnc.com', 'No-IP'],
  ['serveblog.net', 'No-IP'],
  ['servebeer.com', 'No-IP'],
  ['servegame.com', 'No-IP'],
  ['servehalflife.com', 'No-IP'],
  ['servehttp.com', 'No-IP'],
  ['serveirc.com', 'No-IP'],
  ['servemp3.com', 'No-IP'],
  ['servepics.com', 'No-IP'],

  // DuckDNS
  ['duckdns.org', 'DuckDNS'],

  // DynDNS (now Oracle Dyn)
  ['dyndns.org', 'DynDNS'],
  ['dyndns.biz', 'DynDNS'],
  ['dyndns.info', 'DynDNS'],
  ['dyndns.tv', 'DynDNS'],
  ['dyndns.ws', 'DynDNS'],
  ['dynalias.com', 'DynDNS'],
  ['dynalias.net', 'DynDNS'],
  ['dynalias.org', 'DynDNS'],
  ['homeip.net', 'DynDNS'],
  ['homelinux.com', 'DynDNS'],
  ['homelinux.net', 'DynDNS'],
  ['homelinux.org', 'DynDNS'],
  ['homeunix.com', 'DynDNS'],
  ['homeunix.net', 'DynDNS'],
  ['homeunix.org', 'DynDNS'],
  ['dnsalias.com', 'DynDNS'],
  ['dnsalias.net', 'DynDNS'],
  ['dnsalias.org', 'DynDNS'],
  ['dnsdojo.com', 'DynDNS'],
  ['dnsdojo.net', 'DynDNS'],
  ['dnsdojo.org', 'DynDNS'],
  ['is-a-geek.com', 'DynDNS'],
  ['is-a-geek.net', 'DynDNS'],
  ['is-a-geek.org', 'DynDNS'],

  // Dynu
  ['dynu.com', 'Dynu'],
  ['dynu.net', 'Dynu'],
  ['accesscam.org', 'Dynu'],
  ['camdvr.org', 'Dynu'],
  ['freeddns.org', 'Dynu'],
  ['mywire.org', 'Dynu'],
  ['webredirect.org', 'Dynu'],
  ['myddns.rocks', 'Dynu'],
  ['blogsite.xyz', 'Dynu'],

  // FreeDNS (afraid.org)
  ['afraid.org', 'FreeDNS'],
  ['chickenkiller.com', 'FreeDNS'],
  ['crabdance.com', 'FreeDNS'],
  ['ignorelist.com', 'FreeDNS'],
  ['jumpingcrab.com', 'FreeDNS'],
  ['mooo.com', 'FreeDNS'],
  ['strangled.net', 'FreeDNS'],
  ['twilightparadox.com', 'FreeDNS'],
  ['us.to', 'FreeDNS'],

  // ChangeIP
  ['changeip.com', 'ChangeIP'],
  ['changeip.net', 'ChangeIP'],
  ['changeip.org', 'ChangeIP'],
  ['dns-dns.com', 'ChangeIP'],
  ['dns04.com', 'ChangeIP'],
  ['dns05.com', 'ChangeIP'],
  ['dnsrd.com', 'ChangeIP'],
  ['got-game.org', 'ChangeIP'],
  ['onmypc.biz', 'ChangeIP'],
  ['onmypc.info', 'ChangeIP'],
  ['onmypc.net', 'ChangeIP'],
  ['onmypc.org', 'ChangeIP'],
  ['onmypc.us', 'ChangeIP'],
  ['ygto.com', 'ChangeIP'],

  // DNS Exit
  ['dnsexit.com', 'DNS Exit'],
  ['dnsexit.net', 'DNS Exit'],
  ['linkpc.net', 'DNS Exit'],
  ['publicvm.com', 'DNS Exit'],
  ['online.tm', 'DNS Exit'],

  // YDNS
  ['ydns.eu', 'YDNS'],

  // nsupdate.info
  ['nsupdate.info', 'nsupdate.info'],

  // Securepoint
  ['spdns.de', 'Securepoint'],
  ['spdns.eu', 'Securepoint'],
  ['spdns.org', 'Securepoint'],

  // Other commonly abused DDNS
  ['3utilities.com', 'Other'],
  ['ddnsking.com', 'Other'],
  ['gotdns.ch', 'Other'],
  ['kozow.com', 'Other'],
  ['loseyourip.com', 'Other'],
  ['ooguy.com', 'Other'],
  ['theworkpc.com', 'Other'],
  ['casacam.net', 'Other'],
  ['mynetav.net', 'Other'],
  ['mynetav.org', 'Other'],
  ['my-vigor.de', 'Other'],
  ['syn-alias.com', 'Other'],
  ['synology-ds.de', 'Other'],
  ['synology-diskstation.de', 'Other'],
  ['synology.me', 'Synology'],
  ['diskstation.me', 'Synology'],
  ['dscloud.biz', 'Synology'],
  ['dscloud.me', 'Synology'],
  ['dscloud.mobi', 'Synology'],
  ['i234.me', 'Synology'],
  ['myds.me', 'Synology'],
  ['quickconnect.cn', 'Synology'],
  ['quickconnect.to', 'Synology'],

  // QNAP
  ['myqnapcloud.com', 'QNAP'],
  ['qnapcloud.com', 'QNAP'],

  // Cloudflare Tunnel (not traditional DDNS but similar abuse pattern)
  ['trycloudflare.com', 'Cloudflare'],

  // ngrok
  ['ngrok.io', 'ngrok'],
  ['ngrok-free.app', 'ngrok'],
  ['ngrok.app', 'ngrok'],
]);

/**
 * DDNS detection result
 */
export interface DDNSResult {
  /** Whether domain uses a DDNS service */
  isDDNS: boolean;
  /** DDNS provider name if detected */
  provider: string | null;
  /** The DDNS domain that matched */
  matchedDomain: string | null;
}

/**
 * Check if a domain uses a DDNS service
 *
 * @param domain - Full domain name to check
 * @returns DDNS detection result
 */
export function checkDDNS(domain: string): DDNSResult {
  const lowerDomain = domain.toLowerCase();

  // Check each DDNS provider domain
  for (const [ddnsDomain, provider] of DDNS_PROVIDERS) {
    // Match exact domain or subdomain
    if (lowerDomain === ddnsDomain || lowerDomain.endsWith(`.${ddnsDomain}`)) {
      return {
        isDDNS: true,
        provider,
        matchedDomain: ddnsDomain,
      };
    }
  }

  return {
    isDDNS: false,
    provider: null,
    matchedDomain: null,
  };
}

/**
 * Get list of all known DDNS provider domains
 *
 * @returns Array of DDNS domain strings
 */
export function getDDNSProviderDomains(): string[] {
  return Array.from(DDNS_PROVIDERS.keys());
}

/**
 * Get list of unique DDNS provider names
 *
 * @returns Array of provider names
 */
export function getDDNSProviderNames(): string[] {
  return [...new Set(DDNS_PROVIDERS.values())];
}
