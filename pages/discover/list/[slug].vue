<template>
  <AppShell>
    <PageContainer>
      <Section>
        <Spinner v-if="isLoading && !list" :message="$t('discover.loading')" />

        <DiscoverListDetail
          v-else-if="list"
          :list="list"
          :items="items"
          :is-loading="false"
        />

        <EmptyState
          v-else
          :message="$t('discover.listNotFound')"
          icon="default"
        />
      </Section>
    </PageContainer>
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useDiscoverListKeywords } from '@/composables/useSeoKeywords';
import AppShell from '@/components/layout/AppShell.vue';
import PageContainer from '@/components/layout/PageContainer.vue';
import Section from '@/components/layout/Section.vue';
import DiscoverListDetail from '@/components/DiscoverListDetail.vue';
import EmptyState from '@/components/EmptyState.vue';
import Spinner from '@/components/Spinner.vue';
import type {
  DiscoverList,
  DiscoverListItem,
} from '@/composables/database/discoverLists';

const { t, locale } = useI18n();
const route = useRoute();

// SEO: hreflang and canonical
const { hreflangLinks } = useHreflang();
const { canonicalUrl } = useCanonical();

const { data: listResponse, pending: isLoading } = await useAsyncData(
  `discover-list-${String(route.params.lang || locale.value)}-${String(route.params.slug || '')}`,
  async () => {
    const slug = route.params.slug as string;
    if (!slug) {
      return {
        success: false,
        list: null as DiscoverList | null,
        items: [] as DiscoverListItem[],
      };
    }

    try {
      const queryParams = new URLSearchParams({
        language: locale.value,
      });
      return await $fetch<{
        success: boolean;
        list: DiscoverList;
        items: DiscoverListItem[];
      }>(`/api/discover/list/${slug}?${queryParams.toString()}`);
    } catch (error) {
      const { logError } = useLogger();
      logError('[Discover] Error fetching list', error as Error, {
        slug,
      });
      return {
        success: false,
        list: null as DiscoverList | null,
        items: [] as DiscoverListItem[],
      };
    }
  },
  {
    watch: [locale, () => route.params.slug],
  }
);

const list = computed(() =>
  listResponse.value?.success ? listResponse.value.list : null
);
const items = computed(() =>
  listResponse.value?.success ? listResponse.value.items : null
);

const pageTitle = computed(() => {
  if (list.value) {
    return `${list.value.title} – ${t('discover.title')}`;
  }
  return t('discover.title');
});

const pageDescription = computed(() => {
  if (list.value?.description) {
    return list.value.description;
  }
  return t('discover.description');
});

// SEO keywords
const { seoKeywords: listKeywords } = useDiscoverListKeywords(
  computed(() => list.value)
);
const seoKeywords = listKeywords;

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
      href: canonicalUrl,
    },
  ],
});

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogType: 'website',
  ogUrl: canonicalUrl,
  twitterCard: 'summary_large_image',
  robots: 'index, follow',
});

</script>
