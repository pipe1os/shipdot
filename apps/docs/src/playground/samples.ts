import type { SourceFile } from '@shipdot/core/compile'

/** The entries the playground starts with. */
export const SAMPLES: SourceFile[] = [
  {
    path: '2026-10-14-export-excel.md',
    content: `---
date: 2026-10-14
type: new
title: Export to Excel
target: "#btn-export"
link: https://pipe1os.github.io/shipdot/guides/hotspots/
---
Download any report as an **Excel** file with one click.
The export keeps your filters and column order.
`,
  },
  {
    path: '2026-10-14-export-excel.es.md',
    content: `---
title: Exportar a Excel
---
Descarga cualquier reporte como archivo de **Excel** con un clic.
La exportación mantiene tus filtros y el orden de las columnas.
`,
  },
  {
    path: '2026-10-14-export-excel.pt.md',
    content: `---
title: Exportar para o Excel
---
Baixe qualquer relatório como arquivo do **Excel** com um clique.
A exportação mantém seus filtros e a ordem das colunas.
`,
  },
  {
    path: '2026-10-01-saved-filters.md',
    content: `---
date: 2026-10-01
type: improved
title: Save your filters
target: "#btn-filter"
---
Save a set of filters once and reuse it from the **Filter** menu.
`,
  },
  {
    path: '2026-09-18-chart-dates.md',
    content: `---
date: 2026-09-18
type: fixed
title: Chart tooltips show the right date
---
Tooltips no longer show the previous day for users west of UTC.
`,
  },
]

export const NEW_ENTRY = (date: string): string => `---
date: ${date}
type: new
title: Something new
# target: "#btn-share"
---
Describe the change for your users.
`
