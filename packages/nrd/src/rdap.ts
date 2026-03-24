/**
 * RDAP (Registration Data Access Protocol) Client
 *
 * Queries RDAP servers to retrieve domain registration information,
 * particularly registration dates for NRD detection.
 *
 * Uses https://rdap.org/ as the bootstrap server which automatically
 * redirects to the correct authoritative RDAP server.
 */

/**
 * RDAP event object
 */
export interface RDAPEvent {
  eventAction: string; // 'registration', 'expiration', 'last changed', etc.
  eventDate: string; // ISO 8601 format
}

/**
 * RDAP domain object
 */
export interface RDAPResponse {
  objectClassName: string;
  handle?: string;
  ldhName?: string; // Lowercase Internationalized Domain Name
  unicodeName?: string;
  events?: RDAPEvent[];
  status?: string[];
  entities?: unknown[];
  nameservers?: unknown[];
}

const RDAP_BOOTSTRAP_URL = 'https://rdap.org/domain/';

/**
 * Query RDAP server for domain information
 *
 * @param domain - Domain name to query
 * @param timeout - Request timeout in milliseconds
 * @returns RDAP response object
 * @throws Error if request fails or times out
 */
export async function queryRDAP(
  domain: string,
  timeout: number = 5000
): Promise<RDAPResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${RDAP_BOOTSTRAP_URL}${domain}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rdap+json, application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`RDAP query failed: ${response.status}`);
    }

    return (await response.json()) as RDAPResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract registration date from RDAP response
 *
 * Looks for the 'registration' event in the events array
 * and returns the eventDate if found.
 *
 * @param rdap - RDAP response object
 * @returns ISO 8601 registration date or null
 */
export function extractRegistrationDate(rdap: RDAPResponse): string | null {
  if (!rdap.events) return null;

  const registrationEvent = rdap.events.find(
    (e) => e.eventAction === 'registration'
  );

  return registrationEvent?.eventDate ?? null;
}

/**
 * Extract domain status from RDAP response
 *
 * Domain statuses indicate various states (active, expired, pending transfer, etc.)
 *
 * @param rdap - RDAP response object
 * @returns Array of status strings
 */
export function extractDomainStatus(rdap: RDAPResponse): string[] {
  return rdap.status ?? [];
}
