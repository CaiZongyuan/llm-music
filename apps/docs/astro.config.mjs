import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import site from './.generated/site.mjs';
import headingIds from './scripts/heading-ids.mjs';

export default defineConfig({
  site: site.site,
  base: site.base,
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: { processor: unified({ remarkPlugins: [headingIds] }) },
  integrations: [starlight({
    title: Object.fromEntries(Object.entries(site.locales).map(([locale, settings]) => [settings.lang, site.title[locale]])),
    defaultLocale: site.defaultLocale,
    locales: site.locales,
    sidebar: site.sidebar,
    logo: { src: './public/favicon.svg' },
    social: [{ icon: 'github', label: 'GitHub', href: site.repository }],
    pagefind: false,
    components: { Search: './src/components/Search.astro' },
    customCss: ['./src/styles/custom.css'],
  })],
});
