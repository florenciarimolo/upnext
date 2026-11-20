/**
 * Fetch and cache videos for titles (movies and TV shows)
 * This endpoint should NOT be called directly from UI components
 * Always use through useVideos composable for consistency and proper error handling
 */

import { defineEventHandler, getRouterParams, getQuery } from 'h3';
import { createClient } from '@supabase/supabase-js';
import { createError } from 'h3';
import { TABLES } from '@/constants/db/tables';
import { TITLES_COLUMNS } from '@/constants/db/columns';
import { MEDIA_TYPE } from '@/constants/domain/mediaType';
import { isPreRelease } from '@/utils/preRelease';
import { getVideoLanguageParam } from '@/server/utils/video-language';
import {
  fetchMovieVideos,
  fetchTVShowVideos,
} from '@/server/utils/tmdb-videos';
import { normalizeVideosForStorage } from '@/server/utils/video-normalization';
import { updateTitleVideos } from '@/services/titles';
import { VIDEO_REFRESH_THRESHOLD_HOURS } from '@/constants/domain/videos';
import { getUserTMDBParams } from '@/server/utils/user-tmdb';
import type { MultiLanguageVideos, Video } from '@/types/Video';
import { LanguageIsoCode, DEFAULT_LANGUAGE_ISO } from '@/constants/languages';
import { getPrimaryLanguageForRegion } from '@/utils/language-detection';
import { logError } from '@/server/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

async function resolveTitleVideos(options: {
  supabase: SupabaseClient;
  tmdbIdNum: number;
  type: typeof MEDIA_TYPE.MOVIE | typeof MEDIA_TYPE.TV;
  requestedLang: string | undefined;
  userLanguage: string;
  region: string;
}): Promise<Video[]> {
  const { supabase, tmdbIdNum, type, requestedLang, userLanguage, region } =
    options;

  const targetLanguage = requestedLang
    ? `${requestedLang}-${userLanguage.split('-')[1] || 'ES'}`
    : userLanguage;

  const regionPrimaryLang = getPrimaryLanguageForRegion(region);
  const regionPrimaryLangCode =
    regionPrimaryLang.split('-')[0]?.toLowerCase() || DEFAULT_LANGUAGE_ISO;
  const requestedLangCode =
    targetLanguage.split('-')[0]?.toLowerCase() || DEFAULT_LANGUAGE_ISO;

  const { data: title, error: dbError } = await supabase
    .from(TABLES.TITLES)
    .select('*')
    .eq(TITLES_COLUMNS.TMDB_ID, tmdbIdNum)
    .eq(TITLES_COLUMNS.TYPE, type)
    .maybeSingle();

  if (dbError || !title) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Title not found',
    });
  }

  const preRelease = isPreRelease({
    release_date: title.release_date,
    first_air_date: title.first_air_date,
  });

  const existingVideos = (title.videos as MultiLanguageVideos | null) || null;
  const videosUpdatedAt = title.videos_updated_at
    ? new Date(title.videos_updated_at)
    : null;

  let shouldFetch = false;
  let tmdbFetchLanguage = targetLanguage;

  if (preRelease) {
    if (!videosUpdatedAt) {
      shouldFetch = true;
    } else {
      const hoursSinceUpdate =
        (Date.now() - videosUpdatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate >= VIDEO_REFRESH_THRESHOLD_HOURS) {
        shouldFetch = true;
      }
    }
  } else if (!existingVideos) {
    shouldFetch = true;
  } else if (
    !existingVideos[requestedLangCode] ||
    existingVideos[requestedLangCode].length === 0
  ) {
    shouldFetch = true;
    if (requestedLangCode !== regionPrimaryLangCode) {
      tmdbFetchLanguage = `${regionPrimaryLangCode}-${region || 'ES'}`;
    } else {
      tmdbFetchLanguage = `${LanguageIsoCode.ENGLISH}-${region || 'ES'}`;
    }
  }

  if (shouldFetch) {
    const languageParam = getVideoLanguageParam();
    const { getTMDBConfig } = await import('@/server/utils/config');
    const tmdbConfig = getTMDBConfig(tmdbFetchLanguage, region || 'ES');

    let tmdbVideos;
    if (type === 'movie') {
      tmdbVideos = await fetchMovieVideos(
        tmdbIdNum,
        languageParam,
        tmdbConfig.apiKey,
        tmdbConfig.baseUrl
      );
    } else {
      tmdbVideos = await fetchTVShowVideos(
        tmdbIdNum,
        languageParam,
        tmdbConfig.apiKey,
        tmdbConfig.baseUrl
      );
    }

    if (!tmdbVideos || typeof tmdbVideos !== 'object') {
      throw new Error('Invalid TMDB response: expected object');
    }

    const normalizedVideos = normalizeVideosForStorage(
      tmdbVideos.results || [],
      existingVideos
    );

    await updateTitleVideos(
      tmdbIdNum,
      type === 'movie' ? MEDIA_TYPE.MOVIE : MEDIA_TYPE.TV,
      normalizedVideos,
      new Date(),
      supabase as Parameters<typeof updateTitleVideos>[4]
    );

    return (
      normalizedVideos[requestedLangCode] ||
      normalizedVideos[DEFAULT_LANGUAGE_ISO] ||
      normalizedVideos[LanguageIsoCode.ENGLISH] ||
      Object.values(normalizedVideos)[0] ||
      []
    );
  }

  if (!existingVideos) {
    return [];
  }

  return (
    existingVideos[requestedLangCode] ||
    existingVideos[DEFAULT_LANGUAGE_ISO] ||
    existingVideos[LanguageIsoCode.ENGLISH] ||
    Object.values(existingVideos)[0] ||
    []
  );
}

export default defineEventHandler(async (event) => {
  let tmdbIdNum = 0;
  let type: typeof MEDIA_TYPE.MOVIE | typeof MEDIA_TYPE.TV | undefined;
  try {
    const config = useRuntimeConfig();
    const { tmdbId } = getRouterParams(event) as { tmdbId: string };
    const query = getQuery(event);
    type = query.type as typeof MEDIA_TYPE.MOVIE | typeof MEDIA_TYPE.TV;

    if (!type || (type !== 'movie' && type !== 'tv')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid type parameter. Must be "movie" or "tv"',
      });
    }

    tmdbIdNum = parseInt(tmdbId, 10);
    if (isNaN(tmdbIdNum)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid TMDB ID',
      });
    }

    // Get Supabase client
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || config.public.supabaseAnonKey;
    const supabase = createClient(config.public.supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { language: userLanguage, region } = await getUserTMDBParams(event);
    const regionCode = region || 'ES';
    const langsQuery = typeof query.langs === 'string' ? query.langs : '';

    if (langsQuery) {
      const langList = langsQuery
        .split(',')
        .map((lang) => lang.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 3);
      const results: Video[][] = [];

      for (const langCode of langList) {
        try {
          results.push(
            await resolveTitleVideos({
              supabase,
              tmdbIdNum,
              type,
              requestedLang: langCode,
              userLanguage,
              region: regionCode,
            })
          );
        } catch (langError) {
          logError('[Videos] Fallback language failed', langError as Error, {
            tmdbId: tmdbIdNum,
            type,
            langCode,
          });
          results.push([]);
        }
      }

      return { results };
    }

    return resolveTitleVideos({
      supabase,
      tmdbIdNum,
      type,
      requestedLang: query.lang as string | undefined,
      userLanguage,
      region: regionCode,
    });

  } catch (error: unknown) {
    // Log the actual error for debugging
    const errorObj = error as {
      message?: string;
      stack?: string;
      statusCode?: number;
      statusMessage?: string;
    } | null;
    logError('[Videos] Unexpected error', error as Error, {
      tmdbId: tmdbIdNum,
      type,
      message: errorObj?.message,
      statusCode: errorObj?.statusCode,
      statusMessage: errorObj?.statusMessage,
    });

    // If error is already an H3 error, re-throw it
    if (errorObj?.statusCode && errorObj?.statusMessage) {
      throw error;
    }

    throw createError({
      statusCode: errorObj?.statusCode || 500,
      statusMessage:
        errorObj?.statusMessage || errorObj?.message || 'Error fetching videos',
      data: error,
    });
  }
});
