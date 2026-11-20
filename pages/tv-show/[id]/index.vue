<template>
  <AppShell>
    <PageContainer>
      <div class="w-full pt-0 pb-6 lg:pt-6">
        <!-- Loading state: spinner + text first, then skeleton after delay -->
        <div
          v-if="isLoading && !showSkeleton"
          class="flex items-center justify-center min-h-[80dvh]"
        >
          <Spinner :message="$t('media.loadingTvShow')" />
        </div>
        <template v-else-if="showSkeleton && isLoading">
          <SkeletonMediaDetail />
        </template>

        <!-- Error state -->
        <div
          v-else-if="hasError"
          class="flex items-center justify-center min-h-[80dvh]"
        >
          <div class="w-full max-w-2xl px-4">
            <Alert
              variant="error"
              :message="$t('media.errorLoadingTvShow')"
              :show-icon="true"
            />
          </div>
        </div>

        <!-- Content -->
        <template v-else-if="!isLoading">
          <section class="pt-0 pb-6 w-full space-y-4 md:space-y-8 lg:pt-6">
            <MediaBannerDetail
              :media="tvShowWithProviders as unknown as Media"
              :media-type="MEDIA_TYPE.TV"
              :in-production="tvShowWithProviders.in_production"
            />
          </section>
          <Section>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <h2
                  class="text-2xl font-semibold text-gray-800 md:text-3xl dark:text-gray-300 font-heading"
                >
                  {{ $t('media.seasons') }}
                </h2>
                <Badge
                  v-if="tvShowWithProviders.number_of_seasons"
                  :label="String(tvShowWithProviders.number_of_seasons)"
                  size="md"
                />
              </div>
              <ViewModeSelector
                v-if="tvShowWithProviders.seasons?.length"
                :page-key="seasonsViewModeKey"
                :default-mode="VIEW_MODE.MOSAIC"
              />
            </div>
            <div
              v-if="viewMode === VIEW_MODE.MOSAIC"
              class="grid grid-cols-2 gap-4 mt-4 md:grid-cols-4 lg:grid-cols-5"
            >
              <article
                v-for="season in tvShowWithProviders.seasons"
                :key="season.id"
                class="overflow-hidden relative rounded-3xl border backdrop-blur-xl transition-colors duration-300 dark:bg-gray-900/40 bg-gray-100/80 border-gray-300/50 dark:border-white/10 hover:border-primary-800 dark:hover:border-primary-600/50 hover:shadow-lg hover:shadow-gray-900/20"
                :aria-label="$t('media.viewDetailsOf', { title: season.name })"
              >
                <div class="relative overflow-hidden rounded-t-3xl bg-gray-800 aspect-[2/3]">
                  <nuxt-link
                    :to="seasonPath(season.season_number)"
                    :aria-label="$t('media.viewDetailsOf', { title: season.name })"
                    class="group block relative w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <img
                      v-if="season.poster_path"
                      :src="`https://image.tmdb.org/t/p/w342${season.poster_path}`"
                      :alt="$t('media.posterOf', { title: season.name })"
                      width="342"
                      height="513"
                      class="object-cover w-full h-full transition-transform duration-300 motion-reduce:transition-none group-hover:scale-105 motion-reduce:group-hover:scale-100"
                      loading="lazy"
                      decoding="async"
                    />
                    <div
                      v-else
                      class="flex justify-center items-center w-full h-full text-gray-600 dark:text-gray-500"
                      role="img"
                      :aria-label="
                        $t('media.noPosterAvailableFor', { title: season.name })
                      "
                    >
                      <IconTv icon-class="w-12 h-12" />
                    </div>
                    <div
                      class="flex absolute inset-0 flex-col justify-center items-center px-4 opacity-0 backdrop-blur-md transition-opacity duration-300 motion-reduce:transition-none pointer-events-none group-hover:opacity-100 dark:bg-black/80 bg-white/80"
                    >
                      <p class="font-semibold text-gray-800 dark:text-gray-300">
                        {{ $t('media.viewDetails') }}
                      </p>
                    </div>
                  </nuxt-link>
                  <div
                    v-if="season.vote_average"
                    class="absolute top-2 left-2 z-10 pointer-events-none"
                  >
                    <RatingBadge :rating="season.vote_average" />
                  </div>
                  <div
                    v-if="hasSession"
                    class="absolute top-2 right-2 z-30"
                    :aria-busy="seasonActionPending === season.season_number"
                  >
                    <Tooltip
                      :text="
                        isSeasonFullySeen(
                          season.season_number,
                          season.episode_count || 0
                        )
                          ? $t('episodes.seasonUnmarkAsSeen', {
                              season: season.season_number,
                            })
                          : $t('episodes.seasonMarkAsSeen', {
                              season: season.season_number,
                            })
                      "
                    >
                      <IconButton
                        :aria-label="
                          isSeasonFullySeen(
                            season.season_number,
                            season.episode_count || 0
                          )
                            ? $t('episodes.seasonUnmarkAsSeen', {
                                season: season.season_number,
                              })
                            : $t('episodes.seasonMarkAsSeen', {
                                season: season.season_number,
                              })
                        "
                        size="small"
                        variant="default"
                        :custom-class="
                          isSeasonFullySeen(
                            season.season_number,
                            season.episode_count || 0
                          )
                            ? 'p-2 rounded-full bg-primary-600 hover:bg-primary-700 backdrop-blur-sm [&>svg]:text-white focus-visible:ring-2 focus-visible:ring-white'
                            : 'p-2 rounded-full bg-black/50 hover:bg-gray-700/80 backdrop-blur-sm [&>svg]:text-white focus-visible:ring-2 focus-visible:ring-white'
                        "
                        @click.stop="
                          requestToggleSeasonSeen(
                            season.season_number,
                            season.episode_count || 0
                          )
                        "
                      >
                        <IconEye icon-class="w-4 h-4" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
                <section class="p-4 flex flex-col gap-2 min-w-0">
                  <h3
                    class="text-body font-semibold font-heading text-gray-800 dark:text-gray-300 break-words"
                  >
                    <nuxt-link
                      :to="seasonPath(season.season_number)"
                      class="hover:text-primary-800 dark:hover:text-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                    >
                      {{ season.name }}
                    </nuxt-link>
                  </h3>
                  <div class="flex flex-col gap-1">
                    <div
                      class="flex items-center gap-2 dark:text-gray-300 text-gray-800 text-xs"
                    >
                      <IconCalendar icon-class="w-3 h-3" />
                      <span
                        :class="{
                          italic:
                            !season.air_date || season.air_date.trim() === '',
                        }"
                        >{{
                          formatDateByRegion(season.air_date, userRegion, t)
                        }}</span
                      >
                    </div>
                    <div
                      class="flex items-center gap-2 dark:text-gray-300 text-gray-800 text-xs"
                    >
                      <IconEpisodes icon-class="w-3 h-3" />
                      <span>{{
                        $t(
                          (season.episode_count || 0) === 1
                            ? 'media.episodesCount_one'
                            : 'media.episodesCount_other',
                          {
                            count: season.episode_count || 0,
                          }
                        )
                      }}</span>
                    </div>
                    <div
                      v-if="
                        hasSession &&
                        seenEpisodesCountBySeason[season.season_number] !==
                          undefined
                      "
                      class="flex items-center gap-2 dark:text-gray-300 text-gray-800 text-xs"
                    >
                      <IconEye
                        icon-class="w-3 h-3 text-primary-600 dark:text-primary-400"
                      />
                      <span>{{
                        $t(
                          seenEpisodesCountBySeason[season.season_number] === 1
                            ? 'episodes.episodesSeenCount_one'
                            : 'episodes.episodesSeenCount_other',
                          {
                            count:
                              seenEpisodesCountBySeason[season.season_number],
                          }
                        )
                      }}</span>
                    </div>
                  </div>
                  <BodyText
                    v-if="season.overview"
                    variant="secondary"
                    custom-class="line-clamp-3"
                  >
                    {{ season.overview }}
                  </BodyText>
                  <BodyText v-else variant="muted" custom-class="italic">
                    {{ $t('media.noDescriptionAvailable') }}
                  </BodyText>
                  <nuxt-link
                    v-if="season.overview"
                    :to="seasonPath(season.season_number)"
                    class="self-start text-body font-body font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {{ $t('media.seeMore') }}
                  </nuxt-link>
                </section>
              </article>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <article
                v-for="season in tvShowWithProviders.seasons"
                :key="`season-list-${season.id}`"
                class="overflow-visible relative rounded-3xl border backdrop-blur-xl transition-colors duration-300 dark:bg-gray-900/40 bg-gray-100/80 border-gray-300/50 dark:border-white/10 hover:border-primary-800 dark:hover:border-primary-600/50 hover:shadow-lg hover:shadow-gray-900/20"
                :aria-label="$t('media.viewDetailsOf', { title: season.name })"
              >
                <div class="flex flex-col p-4">
                  <div class="flex flex-row gap-4">
                    <MediaPoster
                      :poster-path="season.poster_path"
                      :link-to="seasonPath(season.season_number)"
                      :link-aria-label="
                        $t('media.viewDetailsOf', { title: season.name })
                      "
                      :image-alt="$t('media.posterOf', { title: season.name })"
                      :no-image-aria-label="
                        $t('media.noPosterAvailableFor', { title: season.name })
                      "
                    />
                    <div class="flex flex-col flex-1 gap-2 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-sm md:text-lg font-semibold text-gray-800 dark:text-gray-300 break-words">
                          <nuxt-link
                            :to="seasonPath(season.season_number)"
                            class="hover:text-primary-800 dark:hover:text-primary-400 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {{ season.name }}
                          </nuxt-link>
                        </h3>
                        <RatingBadge
                          v-if="season.vote_average"
                          :rating="season.vote_average"
                        />
                      </div>
                      <div class="flex flex-col gap-1">
                        <div
                          class="flex items-center gap-2 dark:text-gray-300 text-gray-800 text-xs"
                        >
                          <IconCalendar icon-class="w-3 h-3" aria-hidden="true" />
                          <span
                            :class="{
                              italic:
                                !season.air_date || season.air_date.trim() === '',
                            }"
                            >{{
                              formatDateByRegion(season.air_date, userRegion, t)
                            }}</span
                          >
                        </div>
                        <div
                          class="flex items-center gap-2 dark:text-gray-300 text-gray-800 text-xs"
                        >
                          <IconEpisodes icon-class="w-3 h-3" aria-hidden="true" />
                          <span>{{
                            $t(
                              (season.episode_count || 0) === 1
                                ? 'media.episodesCount_one'
                                : 'media.episodesCount_other',
                              {
                                count: season.episode_count || 0,
                              }
                            )
                          }}</span>
                        </div>
                        <div
                          v-if="
                            hasSession &&
                            seenEpisodesCountBySeason[season.season_number] !==
                              undefined
                          "
                          class="flex items-center gap-2 dark:text-gray-300 text-gray-800 text-xs"
                        >
                          <IconEye
                            icon-class="w-3 h-3 text-primary-600 dark:text-primary-400"
                            aria-hidden="true"
                          />
                          <span>{{
                            $t(
                              seenEpisodesCountBySeason[season.season_number] ===
                              1
                                ? 'episodes.episodesSeenCount_one'
                                : 'episodes.episodesSeenCount_other',
                              {
                                count:
                                  seenEpisodesCountBySeason[
                                    season.season_number
                                  ],
                              }
                            )
                          }}</span>
                        </div>
                      </div>
                      <div class="hidden lg:flex lg:flex-col lg:gap-2">
                        <BodyText
                          v-if="season.overview"
                          variant="secondary"
                          custom-class="line-clamp-3"
                        >
                          {{ season.overview }}
                        </BodyText>
                        <BodyText v-else variant="muted" custom-class="italic">
                          {{ $t('media.noDescriptionAvailable') }}
                        </BodyText>
                        <nuxt-link
                          v-if="season.overview"
                          :to="seasonPath(season.season_number)"
                          class="self-start text-body font-body font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {{ $t('media.seeMore') }}
                        </nuxt-link>
                      </div>
                    </div>
                    <div
                      v-if="hasSession"
                      class="flex flex-shrink-0 items-start"
                      :aria-busy="seasonActionPending === season.season_number"
                    >
                      <Tooltip
                        :text="
                          isSeasonFullySeen(
                            season.season_number,
                            season.episode_count || 0
                          )
                            ? $t('episodes.seasonUnmarkAsSeen', {
                                season: season.season_number,
                              })
                            : $t('episodes.seasonMarkAsSeen', {
                                season: season.season_number,
                              })
                        "
                      >
                        <IconButton
                          :aria-label="
                            isSeasonFullySeen(
                              season.season_number,
                              season.episode_count || 0
                            )
                              ? $t('episodes.seasonUnmarkAsSeen', {
                                  season: season.season_number,
                                })
                              : $t('episodes.seasonMarkAsSeen', {
                                  season: season.season_number,
                                })
                          "
                          size="small"
                          variant="default"
                          :custom-class="
                            isSeasonFullySeen(
                              season.season_number,
                              season.episode_count || 0
                            )
                              ? 'p-2 rounded-full bg-primary-600 hover:bg-primary-700 backdrop-blur-sm [&>svg]:text-white focus-visible:ring-2 focus-visible:ring-white'
                              : 'p-2 rounded-full bg-black/50 hover:bg-gray-700/80 backdrop-blur-sm [&>svg]:text-white focus-visible:ring-2 focus-visible:ring-white'
                          "
                          @click.stop="
                            requestToggleSeasonSeen(
                              season.season_number,
                              season.episode_count || 0
                            )
                          "
                        >
                          <IconEye icon-class="w-4 h-4" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                  <div class="lg:hidden mt-2">
                    <BodyText
                      v-if="season.overview"
                      variant="secondary"
                      custom-class="line-clamp-3"
                    >
                      {{ season.overview }}
                    </BodyText>
                    <BodyText v-else variant="muted" custom-class="italic">
                      {{ $t('media.noDescriptionAvailable') }}
                    </BodyText>
                    <nuxt-link
                      v-if="season.overview"
                      :to="seasonPath(season.season_number)"
                      class="mt-2 inline-block text-body font-body font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {{ $t('media.seeMore') }}
                    </nuxt-link>
                  </div>
                </div>
              </article>
            </div>
            <Modal
              :is-open="showUnmarkSeasonModal"
              @close="showUnmarkSeasonModal = false"
            >
              <div>
                <h3 class="text-lg font-semibold mb-2">
                  {{ $t('episodes.confirmUnmarkSeason') }}
                </h3>
                <p class="mb-4">
                  {{
                    $t('episodes.confirmUnmarkSeasonMessage', {
                      season: seasonPendingUnmark,
                    })
                  }}
                </p>
                <div class="flex gap-2 justify-end">
                  <Button variant="ghost" @click="showUnmarkSeasonModal = false">
                    {{ $t('common.cancel') }}
                  </Button>
                  <Button variant="primary" @click="confirmUnmarkSeason">
                    {{ $t('common.confirm') }}
                  </Button>
                </div>
              </div>
            </Modal>
          </Section>
        </template>
      </div>
    </PageContainer>
  </AppShell>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useFetch, useSeoMeta, useHead } from 'nuxt/app';
import { computed, onMounted, watch, ref } from 'vue';
import { useRouteWithLang } from '@/composables/useRouteWithLang';
import { useUserRegion } from '@/composables/useUserRegion';

import type { TVShow } from '@/types/TVShow';
import { formatDateByRegion } from '@/utils/formatDate';
import { WatchProviderTypes } from '@/types/WatchProvider';
import MediaBannerDetail from '@/components/MediaBannerDetail.vue';
import { MEDIA_TYPE } from '@/constants/domain/mediaType';
import type { Media } from '@/types/Media';
import IconCalendar from '@/components/icons/IconCalendar.vue';
import IconEpisodes from '@/components/icons/IconEpisodes.vue';
import IconEye from '@/components/icons/IconEye.vue';
import IconTv from '@/components/icons/IconTv.vue';
import Badge from '@/components/Badge.vue';
import RatingBadge from '@/components/RatingBadge.vue';
import BodyText from '@/components/typography/BodyText.vue';
import IconButton from '@/components/ui/IconButton.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { useEpisodeStatus } from '@/composables/useEpisodeStatus';
import { useSupabaseUser } from '#imports';
import { useLogger } from '@/composables/useLogger';
import { useTVShowSchema } from '@/composables/useSchemaOrg';
import { getTVShowSeoExperience } from '@/composables/useSeoExperience';
import { useTVShowKeywords } from '@/composables/useSeoKeywords';
import AppShell from '@/components/layout/AppShell.vue';
import PageContainer from '@/components/layout/PageContainer.vue';
import Section from '@/components/layout/Section.vue';
import Alert from '@/components/ui/Alert.vue';
import MediaPoster from '@/components/ui/MediaPoster.vue';
import ViewModeSelector from '@/components/ViewModeSelector.vue';
import { useViewMode } from '@/composables/useViewMode';
import { VIEW_MODE } from '@/constants/domain/viewMode';
import { useUndoToast } from '@/composables/useUndoToast';

const route = useRoute();
const { getUserRegion } = useUserRegion();
const userRegion = ref<string | null>(null);
const { lang } = useRouteWithLang();
const user = useSupabaseUser();
const hasSession = computed(() => !!user.value);
const { logError } = useLogger();
const { showToast } = useUndoToast();

// Get current language URL code for API calls
const currentLangUrlCode = computed(() => lang.value);

const tvShowId = route.params.id;
const tmdbSeriesId = computed(() => parseInt(String(tvShowId), 10));

// Episode status management
const {
  fetchEpisodeStatuses,
  isEpisodeSeen,
  markSeasonSeen,
  unmarkSeason,
} = useEpisodeStatus(tmdbSeriesId);

// No await: page mounts immediately and shows loading state (text then skeleton)
const {
  data: tvShowDetails,
  pending: tvShowPending,
  error: tvShowError,
  refresh: refreshTVShowDetails,
} = useFetch<TVShow>(`/api/tmdb/tvshows/${tvShowId}`, {
  query: { lang: currentLangUrlCode },
});

const {
  data: tvProviders,
  pending: tvProvidersPending,
  error: tvProvidersError,
  refresh: refreshTVProviders,
} = useFetch(`/api/tmdb/tvshows/${tvShowId}/providers`, {
  query: { lang: currentLangUrlCode },
});

// Watch for language changes in URL and refresh all data
// CRITICAL: Watch lang.value (from route.params.lang) instead of locale.value
// The URL is the source of truth for language
watch(
  () => lang.value,
  async (newLang, oldLang) => {
    if (newLang && oldLang && newLang !== oldLang) {
      // Development-only logging removed
      // Refresh all data with new language
      await Promise.all([refreshTVShowDetails(), refreshTVProviders()]);
    }
  },
  { immediate: false }
);

const isLoading = computed(
  () => tvShowPending.value || tvProvidersPending.value
);
const hasError = computed(() => tvShowError.value || tvProvidersError.value);

// Skeleton loading state with delay (500-700ms)
const showSkeleton = ref(false);
let skeletonTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Watch isLoading to show skeleton after delay
watch(isLoading, (isLoadingValue) => {
  if (isLoadingValue) {
    // Clear any existing timeout
    if (skeletonTimeoutId) {
      clearTimeout(skeletonTimeoutId);
    }
    // Show skeleton after 600ms delay
    skeletonTimeoutId = setTimeout(() => {
      if (isLoading.value) {
        showSkeleton.value = true;
      }
    }, 600);
  } else {
    // Clear timeout and hide skeleton immediately when loading stops
    if (skeletonTimeoutId) {
      clearTimeout(skeletonTimeoutId);
      skeletonTimeoutId = null;
    }
    showSkeleton.value = false;
  }
});

const tvShow = computed<TVShow>(() => {
  if (!tvShowDetails.value) {
    return {} as TVShow;
  }
  return tvShowDetails.value as TVShow;
});
const tvShowProviders = computed(
  () => (tvProviders.value as WatchProviderTypes) || ({} as WatchProviderTypes)
);

const tvShowWithProviders = computed<TVShow>(() => {
  return {
    ...tvShow.value,
    providers: tvShowProviders.value,
  };
});

// SEO: TV Show page - public, indexable
const config = useRuntimeConfig();
const siteUrl = config.public.baseUrl || config.public.siteUrl;

const { t } = useI18n();
const { routeWithLang } = useRouteWithLang();

const seasonPath = (seasonNumber: number) =>
  routeWithLang(`/tv-show/${tvShowId}/season/${seasonNumber}`);

const seasonsViewModeKey = 'tv-show-seasons';
const { viewMode } = useViewMode(seasonsViewModeKey, VIEW_MODE.MOSAIC);

const showUnmarkSeasonModal = ref(false);
const seasonActionPending = ref<number | null>(null);
const seasonPendingUnmark = ref<number | null>(null);

// Get SEO experience based on genre
const seoExperienceKey = computed(() => getTVShowSeoExperience(tvShow.value));
const seoExperience = computed(() => t(seoExperienceKey.value));

// Meta tags dinámicos
const pageTitle = computed(() => {
  const name = tvShow.value?.name || t('media.series');
  return `${name} – ${t('seo.tvShowPrefix')} ${seoExperience.value}`;
});

const pageDescription = computed(() => {
  const title = tvShow.value?.name || t('media.series');
  const experience = seoExperience.value;
  return t('seo.tvShowDescription', { title, experience });
});

const posterUrl = computed(() => {
  if (tvShow.value?.poster_path) {
    return `https://image.tmdb.org/t/p/w500${tvShow.value.poster_path}`;
  }
  return '';
});

const ogImage = computed(() => posterUrl.value);

// Canonical URL - ensure unique, avoid duplicates with /tv-show/[id]/index
// SEO: hreflang and canonical
const { hreflangLinks } = useHreflang();
const { canonicalUrl: canonicalUrlFromComposable } = useCanonical();

// Schema.org JSON-LD
const tvShowSchema = computed(() => {
  if (!tvShow.value) return null;
  return useTVShowSchema(tvShow.value, siteUrl);
});

// SEO keywords
const { seoKeywords: tvShowKeywords } = useTVShowKeywords(
  computed(() => tvShow.value)
);
const seoKeywords = tvShowKeywords;

useHead({
  title: pageTitle,
  meta: [
    {
      name: 'description',
      content: pageDescription,
    },
    {
      name: 'keywords',
      content: seoKeywords,
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
  ],
  link: [
    ...hreflangLinks.value,
    {
      rel: 'canonical',
      href: canonicalUrlFromComposable,
    },
  ],
  script: tvShowSchema.value
    ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(tvShowSchema.value),
        },
      ]
    : [],
});

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogImage: ogImage,
  ogImageAlt: computed(() => {
    const name = tvShow.value?.name || t('media.series');
    return t('media.posterOf', { title: name });
  }),
  ogType: 'video.tv_show',
  ogUrl: canonicalUrlFromComposable,
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: ogImage,
  robots: 'index, follow',
});

// Calculate seen episodes count for all seasons
const seenEpisodesCountBySeason = computed(() => {
  const counts: Record<number, number> = {};
  if (!tvShowWithProviders.value?.seasons) return counts;
  
  tvShowWithProviders.value.seasons.forEach((season) => {
    if (!season.episode_count) {
      counts[season.season_number] = 0;
      return;
    }
    
    // Count seen episodes in this season
    let seenCount = 0;
    for (let episodeNumber = 1; episodeNumber <= season.episode_count; episodeNumber++) {
      if (isEpisodeSeen(season.season_number, episodeNumber)) {
        seenCount++;
      }
    }
    counts[season.season_number] = seenCount;
  });
  
  return counts;
});

// Check if a season is fully seen (all episodes seen)
const isSeasonFullySeen = (seasonNumber: number, episodeCount: number) => {
  if (!episodeCount || episodeCount === 0) return false;
  
  for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber++) {
    if (!isEpisodeSeen(seasonNumber, episodeNumber)) {
      return false;
    }
  }
  
  return true;
};

// Handlers for season seen actions
const handleMarkSeasonSeen = async (seasonNumber: number) => {
  if (seasonActionPending.value !== null) return;
  seasonActionPending.value = seasonNumber;
  try {
    if (!user.value) {
      showToast(t('media.authRequired'), null, 3000);
      return;
    }

    await markSeasonSeen(seasonNumber);
    await fetchEpisodeStatuses();

    // Show success toast with undo
    showToast(
      t('episodes.seasonMarkedAsSeen'),
      {
        label: t('undo.undo'),
        action: async () => {
          await handleUnmarkSeason(seasonNumber);
        },
      },
      7000
    );
  } catch (error) {
    logError('[TV Show Detail] Error marking season as seen', error as Error, {
      seasonNumber,
      tmdbSeriesId: tmdbSeriesId.value,
    });
    showToast(
      t('home.errorUpdatingStatus', {
        title: t('episodes.seasonMarkAsSeen', { season: seasonNumber }),
      }),
      null,
      3000
    );
  } finally {
    seasonActionPending.value = null;
  }
};

const handleUnmarkSeason = async (seasonNumber: number) => {
  try {
    if (!user.value) {
      showToast(t('media.authRequired'), null, 3000);
      return;
    }

    await unmarkSeason(seasonNumber);
    await fetchEpisodeStatuses();

    // Show success toast
    showToast(
      t('episodes.seasonUnmarkAsSeen', { season: seasonNumber }) + ' ✓',
      null,
      3000
    );
  } catch (error) {
    logError('[TV Show Detail] Error unmarking season', error as Error, {
      seasonNumber,
      tmdbSeriesId: tmdbSeriesId.value,
    });
    showToast(
      t('home.errorUpdatingStatus', {
        title: t('episodes.seasonUnmarkAsSeen', { season: seasonNumber }),
      }),
      null,
      3000
    );
  }
};

const requestToggleSeasonSeen = (seasonNumber: number, episodeCount: number) => {
  if (seasonActionPending.value !== null) return;
  if (isSeasonFullySeen(seasonNumber, episodeCount)) {
    seasonPendingUnmark.value = seasonNumber;
    showUnmarkSeasonModal.value = true;
    return;
  }
  handleMarkSeasonSeen(seasonNumber);
};

const confirmUnmarkSeason = async () => {
  const seasonNumber = seasonPendingUnmark.value;
  showUnmarkSeasonModal.value = false;
  seasonPendingUnmark.value = null;
  if (seasonNumber === null) return;
  await handleUnmarkSeason(seasonNumber);
};

// Save the previous route when mounting
onMounted(async () => {
  // Get user region for date formatting
  userRegion.value = await getUserRegion();
  
  if (user.value) {
    await fetchEpisodeStatuses();
  }
  if (import.meta.client) {
    const referrer = document.referrer;
    const currentOrigin = window.location.origin;

    // Only save if the referrer is from the same origin (within the app)
    if (referrer && referrer.startsWith(currentOrigin)) {
      try {
        const referrerPath = new URL(referrer).pathname;
        // Don't save if we're coming from another detail page or season page (to avoid loops)
        // Check for paths with language prefix (e.g., /es/movie/, /en/tv-show/)
        const hasLangPrefix = referrerPath
          .split('/')
          .filter(Boolean)[0]
          ?.match(/^(es|ca|eu|gl|en|en-gb)$/i);
        const pathWithoutLang = hasLangPrefix
          ? '/' + referrerPath.split('/').slice(2).join('/')
          : referrerPath;

        if (
          !pathWithoutLang.startsWith('/movie/') &&
          !pathWithoutLang.startsWith('/tv-show/')
        ) {
          sessionStorage.setItem('previousRoute', referrerPath);
        }
      } catch {
        // If URL parsing fails, ignore
      }
    }
  }
});
</script>

<style scoped>
.line-clamp-3 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
</style>
