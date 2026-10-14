export interface Strings {
  title: string
  /** `{n}` is replaced with the number of unread entries. */
  unread: string
  unreadOne: string
  close: string
  gotIt: string
  more: string
  empty: string
  new: string
  improved: string
  fixed: string
}

/** Built-in UI strings. The feed's own text is translated in the entries themselves. */
export const STRINGS: Record<string, Strings> = {
  en: {
    title: "What's new",
    unread: '{n} unread',
    unreadOne: 'Unread',
    close: 'Close',
    gotIt: 'Got it',
    more: 'Learn more',
    empty: 'Nothing new yet.',
    new: 'New',
    improved: 'Improved',
    fixed: 'Fixed',
  },
  es: {
    title: 'Novedades',
    unread: '{n} sin leer',
    unreadOne: 'Sin leer',
    close: 'Cerrar',
    gotIt: 'Entendido',
    more: 'Más información',
    empty: 'Aún no hay novedades.',
    new: 'Nuevo',
    improved: 'Mejorado',
    fixed: 'Corregido',
  },
  pt: {
    title: 'Novidades',
    unread: '{n} não lidas',
    unreadOne: 'Não lida',
    close: 'Fechar',
    gotIt: 'Entendi',
    more: 'Saiba mais',
    empty: 'Nenhuma novidade ainda.',
    new: 'Novo',
    improved: 'Melhorado',
    fixed: 'Corrigido',
  },
}

/** UI strings for a locale tag (`pt-BR` → `pt`), falling back to English. */
export const stringsFor = (locale: string): Strings =>
  STRINGS[locale.toLowerCase().split('-')[0] as string] ?? (STRINGS.en as Strings)
