<template>
  <AppShell>
    <PageContainer>
      <Section>
        <div class="space-y-4 text-left">
          <PageTitle>
            {{ $t('discover.title') }}
          </PageTitle>
          <p class="text-subtitle font-body text-gray-800 dark:text-gray-300">
            {{ $t('discover.description') }}
          </p>
        </div>

        <Spinner v-if="isLoading" :message="$t('discover.loading')" />

        <template v-else>
          <!-- CTA for non-logged users -->
          <div
            v-if="!isLoggedIn"
            class="mb-6 p-4 rounded-2xl border backdrop-blur-xl dark:bg-gray-900/40 bg-gray-100/80 border-gray-300/50 dark:border-white/10"
          >
            <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
              {{ $t('discover.loginCta') }}
            </p>
            <Button variant="primary" @click="showAuthForm = true">
              {{ $t('auth.login') }}
            </Button>
          </div>

          <div
            v-if="lists && lists.length > 0"
            class="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <DiscoverListCard
              v-for="list in lists"
              :key="list.id"
              :list="list"
            />
          </div>

          <EmptyState
            v-else-if="!lists || lists.length === 0"
            :message="$t('discover.empty')"
          />
        </template>
      </Section>

      <!-- Auth Form Modal -->
      <Modal
        :is-open="showAuthForm"
        custom-class="max-w-md p-0"
        @close="showAuthForm = false"
      >
        <AuthForm in-modal @success="showAuthForm = false" @signup="() => {}" />
      </Modal>
    </PageContainer>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useHreflang } from '@/composables/useHreflang';
import { useCanonical } from '@/composables/useCanonical';
import { useDiscoverKeywords } from '@/composables/useSeoKeywords';
import AppShell from '@/components/layout/AppShell.vue';
import PageContainer from '@/components/layout/PageContainer.vue';
import Section from '@/components/layout/Section.vue';
import PageTitle from '@/components/typography/PageTitle.vue';
import DiscoverListCard from '@/components/DiscoverListCard.vue';
import Spinner from '@/components/Spinner.vue';
import EmptyState from '@/components/EmptyState.vue';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';
import AuthForm from '@/components/AuthForm.vue';
import type { DiscoverList } from '@/composables/database/discoverLists';

interface ExtendedDiscoverList extends DiscoverList {
  itemCount?: number;
  previewPosters?: (string | null)[];
}

const { t, locale } = useI18n();
const route = useRoute();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Auto-imported
const user = useSupabaseUser();
const isLoggedIn = computed(() => !!user.value);
const showAuthForm = ref(false);

// SEO: hreflang and canonical
const { hreflangLinks } = useHreflang();
const { canonicalUrl } = useCanonical();

// SEO keywords
const { seoKeywords: discoverKeywords } = useDiscoverKeywords();
const seoKeywords = discoverKeywords;

useHead({
  title: t('discover.title'),
  meta: [
    {
      name: 'description',
      content: t('discover.description'),
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
    ...(hreflangLinks.value || []),
    {
      rel: 'canonical',
      href: canonicalUrl,
    },
  ],
});

useSeoMeta({
  title: t('discover.title'),
  description: t('discover.description'),
  ogTitle: t('discover.title'),
  ogDescription: t('discover.description'),
  ogType: 'website',
  ogUrl: canonicalUrl,
  twitterCard: 'summary_large_image',
  robots: 'index, follow',
});

const { data: listsResponse, pending: isLoading } = await useAsyncData(
  `discover-lists-${String(route.params.lang || locale.value)}`,
  async () => {
    try {
      return await $fetch<{
        success: boolean;
        lists: ExtendedDiscoverList[];
      }>(`/api/discover/lists?language=${encodeURIComponent(locale.value)}`);
    } catch (error) {
      const { logError } = useLogger();
      logError('[Discover] Error fetching lists', error as Error);
      return { success: false, lists: [] as ExtendedDiscoverList[] };
    }
  },
  {
    watch: [locale],
  }
);

const lists = computed(() =>
  listsResponse.value?.success ? listsResponse.value.lists : null
);
</script>
