/**
 * Content region for UpNext.
 * The catalog and streaming providers are Spain-only.
 * ISO 3166-1 alpha-2 country code.
 */
export interface Region {
  code: string;
  name: string;
}

export const AVAILABLE_REGIONS: Region[] = [{ code: 'ES', name: 'España' }];

/**
 * The only content region. Catalog, providers, and recommendation pool use this code.
 */
export const DEFAULT_REGION = 'ES';

