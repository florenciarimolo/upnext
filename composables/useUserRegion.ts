import { DEFAULT_REGION } from '@/constants/regions';

/**
 * The content region is always Spain.
 * Callers keep this composable so date formatting and language fallback stay in one place.
 */
export const useUserRegion = () => {
  const getUserRegion = async (_forceRefresh = false): Promise<string> => {
    return _forceRefresh ? DEFAULT_REGION : DEFAULT_REGION;
  };

  const clearRegionCache = () => {
    // Region is fixed. Nothing to invalidate.
  };

  return {
    getUserRegion,
    clearRegionCache,
  };
};
