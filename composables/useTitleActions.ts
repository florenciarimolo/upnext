import { ref, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSupabaseUser } from '#imports';
import { getSession } from '@/services/auth';
import { getUserLikedTitle } from '@/services/userTitleStatus';
import { getTitleByTmdbIdWithLanguage } from '@/services/titles';
import { useUserRegion } from '@/composables/useUserRegion';
import { useTitleStatusAction } from '@/composables/useTitleStatusAction';
import { QUERY_PARAMS } from '@/constants/api/queryParams';
import type { Recommendation } from '@/types/Recommendation';
import {
  TITLE_STATUS,
  type TitleStatusType,
} from '@/constants/domain/titleStatus';

// Helper function to safely get user ID from Supabase user object
type SupabaseUserWithSub = {
  id?: string;
  sub?: string;
  [key: string]: unknown;
};

function getUserId(
  user: SupabaseUserWithSub | null | undefined
): string | undefined {
  return user?.id || user?.sub;
}

/**
 * Composable for handling title actions (like, seen, watchlist, etc.)
 */
export const useTitleActions = (
  _recommendations: Ref<Recommendation[]>,
  allRecommendations: Ref<Recommendation[]>,
  filterRecommendationsByType: () => void
) => {
  const route = useRoute();
  const { locale } = useI18n();
  const user = useSupabaseUser();
  const { getUserRegion } = useUserRegion();
  const { executeAction, executeLikedAction } = useTitleStatusAction();

  // Helper function to get title with alphabet detection
  const getTitleWithAlphabetDetection = async (
    title: Recommendation
  ): Promise<string> => {
    try {
      // Get user region from preferences
      const userRegion = await getUserRegion();

      // Get title from database with language detection
      const { data: titleData } = await getTitleByTmdbIdWithLanguage(
        title.tmdb_id,
        title.type,
        locale.value || 'es-ES',
        userRegion
      );

      // If we got a title from database (with alphabet detection), use it
      if (titleData?.title) {
        return titleData.title;
      }
    } catch (error) {
      const { logError } = useLogger();
      logError(
        '[TitleActions] Error getting title with alphabet detection',
        error as Error
      );
    }

    // Fallback to original title if database fetch fails
    return title.title;
  };

  const loadingTitles = ref<Set<number>>(new Set());
  const fetchingReplacement = ref(false);

  type RecommendationSwap = {
    removedId: number;
    index: number;
    original: Recommendation;
    replacementId: number | null;
    undone: boolean;
  };

  const beginSwap = (title: Recommendation): RecommendationSwap | null => {
    const index = allRecommendations.value.findIndex(
      (item) => item.tmdb_id === title.tmdb_id
    );
    if (index === -1) return null;

    const swap: RecommendationSwap = {
      removedId: title.tmdb_id,
      index,
      original: { ...allRecommendations.value[index] },
      replacementId: null,
      undone: false,
    };

    allRecommendations.value = allRecommendations.value.filter(
      (item) => item.tmdb_id !== title.tmdb_id
    );
    filterRecommendationsByType();
    return swap;
  };

  const undoRecommendationSwap = (swap: RecommendationSwap) => {
    if (swap.undone) return;
    swap.undone = true;

    if (swap.replacementId !== null) {
      const replacementIndex = allRecommendations.value.findIndex(
        (item) => item.tmdb_id === swap.replacementId
      );
      if (replacementIndex !== -1) {
        const next = [...allRecommendations.value];
        next.splice(replacementIndex, 1, swap.original);
        allRecommendations.value = next;
        filterRecommendationsByType();
        return;
      }
    }

    const alreadyVisible = allRecommendations.value.some(
      (item) => item.tmdb_id === swap.original.tmdb_id
    );
    if (!alreadyVisible) {
      const next = [...allRecommendations.value];
      next.splice(Math.min(swap.index, next.length), 0, swap.original);
      allRecommendations.value = next;
      filterRecommendationsByType();
    }
  };

  // Helper function to fetch replacement title and put it in the removed slot
  const fetchReplacementTitle = async (
    title: Recommendation,
    swap: RecommendationSwap
  ) => {
    try {
      const {
        data: { session },
      } = await getSession();

      if (!session?.access_token) {
        return;
      }

      fetchingReplacement.value = true;
      // Get current recommendation IDs to exclude them from replacement
      const currentRecommendationIds = allRecommendations.value
        .map((r: Recommendation) => r.tmdb_id)
        .filter((id) => id !== title.tmdb_id); // Exclude the one being replaced

      const queryParams: Record<string, string> = {
        excluded_tmdb_id: title.tmdb_id.toString(),
        excluded_type: title.type,
      };
      if (currentRecommendationIds.length > 0) {
        queryParams.excluded_recommendations =
          currentRecommendationIds.join(',');
      }
      if (route.query[QUERY_PARAMS.MOOD])
        queryParams[QUERY_PARAMS.MOOD] = route.query[
          QUERY_PARAMS.MOOD
        ] as string;
      if (route.query[QUERY_PARAMS.ATTENTION])
        queryParams[QUERY_PARAMS.ATTENTION] = route.query[
          QUERY_PARAMS.ATTENTION
        ] as string;

      const replacement = await $fetch<Recommendation | null>(
        '/api/recommendations/replacement',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          query: queryParams,
        }
      );

      if (swap.undone) return;

      if (replacement) {
        const alreadyExists = allRecommendations.value.some(
          (item: Recommendation) => item.tmdb_id === replacement.tmdb_id
        );
        if (!alreadyExists) {
          swap.replacementId = replacement.tmdb_id;
          const next = [...allRecommendations.value];
          next.splice(Math.min(swap.index, next.length), 0, replacement);
          allRecommendations.value = next;
        }
      }
      filterRecommendationsByType();
    } catch (error) {
      const { logError } = useLogger();
      logError(
        '[TitleActions] Error fetching replacement title',
        error as Error,
        {
          tmdbId: title.tmdb_id,
        }
      );
      filterRecommendationsByType();
    } finally {
      fetchingReplacement.value = false;
    }
  };

  // Handle marking a title with different statuses
  const handleTitleStatus = async (
    title: Recommendation,
    status: TitleStatusType,
    liked: boolean = false
  ) => {
    if (loadingTitles.value.has(title.tmdb_id)) return;
    loadingTitles.value.add(title.tmdb_id);

    const swap = beginSwap(title);

    try {
      const currentStatus = swap?.original.in_watchlist
        ? TITLE_STATUS.WATCHLIST
        : null;

      const titleWithDetection = await getTitleWithAlphabetDetection(title);

      const result = await executeAction(
        {
          tmdb_id: title.tmdb_id,
          type: title.type,
          title: titleWithDetection,
          currentStatus,
          isLiked: liked,
          undoOnAdd: true,
          onUndoComplete: swap
            ? () => undoRecommendationSwap(swap)
            : undefined,
        },
        status
      );

      if (result.success && swap && !swap.undone) {
        await fetchReplacementTitle(title, swap);
      } else if (!result.success && swap) {
        undoRecommendationSwap(swap);
      }
    } catch (error) {
      if (swap) undoRecommendationSwap(swap);

      const { logError } = useLogger();
      logError('[TitleActions] Error handling title status', error as Error, {
        tmdbId: title.tmdb_id,
        status,
      });
    } finally {
      loadingTitles.value.delete(title.tmdb_id);
    }
  };

  // Handle marking as liked (implies seen, removes from watchlist)
  const handleMarkLiked = async (title: Recommendation) => {
    if (loadingTitles.value.has(title.tmdb_id)) return;
    loadingTitles.value.add(title.tmdb_id);

    const swap = beginSwap(title);

    try {
      const userId = getUserId(user.value);
      if (!userId) {
        if (swap) undoRecommendationSwap(swap);
        return;
      }

      const { data: likedTitle } = await getUserLikedTitle(
        userId,
        title.tmdb_id
      );

      if (likedTitle) {
        if (swap) undoRecommendationSwap(swap);
        await confirmRemoveLike(title);
        return;
      }

      const currentStatus = swap?.original.in_watchlist
        ? TITLE_STATUS.WATCHLIST
        : null;

      const titleWithDetection = await getTitleWithAlphabetDetection(title);

      const result = await executeLikedAction(
        {
          tmdb_id: title.tmdb_id,
          type: title.type,
          title: titleWithDetection,
          currentStatus,
          isLiked: false,
          undoOnAdd: true,
          onUndoComplete: swap
            ? () => undoRecommendationSwap(swap)
            : undefined,
        },
        false
      );

      if (result.success && swap && !swap.undone) {
        await fetchReplacementTitle(title, swap);
      } else if (!result.success && swap) {
        undoRecommendationSwap(swap);
      }
    } catch (error) {
      if (swap) undoRecommendationSwap(swap);

      const { logError } = useLogger();
      logError('[TitleActions] Error marking title as liked', error as Error, {
        tmdbId: title.tmdb_id,
      });
    } finally {
      loadingTitles.value.delete(title.tmdb_id);
    }
  };

  // Handle removing like from recommendation card
  const handleRemoveLiked = async (title: Recommendation) => {
    await confirmRemoveLike(title);
  };

  // Handle removing like (no modal needed - just updates score)
  const confirmRemoveLike = async (title: Recommendation) => {
    loadingTitles.value.add(title.tmdb_id);

    try {
      // Get current status (if any)
      const currentStatus = title.in_watchlist
        ? TITLE_STATUS.WATCHLIST
        : TITLE_STATUS.SEEN; // If it's liked, it must have SEEN status

      // Get title with alphabet detection
      const titleWithDetection = await getTitleWithAlphabetDetection(title);

      // Use unified composable for API call and toast
      await executeLikedAction(
        {
          tmdb_id: title.tmdb_id,
          type: title.type,
          title: titleWithDetection,
          currentStatus,
          isLiked: true,
        },
        true
      );

      // Success - no logging needed for normal flow
    } catch (error) {
      const { logError } = useLogger();
      logError('[TitleActions] Error removing like', error as Error, {
        tmdbId: title.tmdb_id,
      });
    } finally {
      loadingTitles.value.delete(title.tmdb_id);
    }
  };

  return {
    loadingTitles,
    fetchingReplacement,
    handleTitleStatus,
    handleMarkLiked,
    handleRemoveLiked,
  };
};
