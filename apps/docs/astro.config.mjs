import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://pipe1os.github.io',
  base: '/shipdot',
  integrations: [
    starlight({
      title: 'shipdot',
      description:
        'Announce new features right where they live. In-app changelog and feature hotspots generated from your pull requests.',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/pipe1os/shipdot' }],
      editLink: { baseUrl: 'https://github.com/pipe1os/shipdot/edit/main/apps/docs/' },
      lastUpdated: false,
      // The header shows shipdot's own "What's new" widget next to the search button (dogfooding);
      // page titles get a "Copy page" menu that copies the page as Markdown.
      components: {
        Search: './src/components/Search.astro',
        PageTitle: './src/components/PageTitle.astro',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start here',
          items: ['getting-started', 'playground', 'how-it-works'],
        },
        {
          label: 'Guides',
          items: [
            'guides/writing-entries',
            'guides/hotspots',
            'guides/i18n',
            'guides/theming',
            'guides/drafting',
            'guides/github-action',
          ],
        },
        { label: 'Frameworks', items: [{ autogenerate: { directory: 'frameworks' } }] },
        {
          label: 'Reference',
          items: ['reference/widget', 'reference/cli', 'reference/config', 'reference/feed'],
        },
        { label: 'Project', items: ['why-shipdot', 'faq'] },
      ],
    }),
  ],
})
