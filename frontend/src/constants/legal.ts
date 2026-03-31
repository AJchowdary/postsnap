/**
 * Bump `LEGAL_DISCLOSURE_VERSION` when Terms / Privacy / AI disclosure materially change
 * so existing users see the modal again (new AsyncStorage key `legal_accepted_v{N}`).
 */
export const LEGAL_DISCLOSURE_VERSION = 1 as const;

export function legalAcceptedStorageKey(version: number = LEGAL_DISCLOSURE_VERSION): string {
  return `legal_accepted_v${version}`;
}
