// Every color pair below meets WCAG 2.1 AA (4.5:1 for text) in both themes.
const VARS = `color-scheme:light dark;font:var(--shipdot-font,400 14px/1.5 system-ui,sans-serif);
--_a:var(--shipdot-accent,light-dark(#4f46e5,#a5b4fc));
--_ac:var(--shipdot-accent-contrast,light-dark(#fff,#18181b));
--_hs:var(--shipdot-hotspot,light-dark(#db2777,#f472b6));
--_bg:var(--shipdot-bg,light-dark(#fff,#18181b));
--_fg:var(--shipdot-fg,light-dark(#18181b,#f4f4f5));
--_mu:var(--shipdot-muted,light-dark(#52525b,#a1a1aa));
--_bd:var(--shipdot-border,light-dark(#e4e4e7,#3f3f46));
--_r:var(--shipdot-radius,12px);
--_sh:var(--shipdot-shadow,0 12px 32px rgb(0 0 0/.2));
--_new:light-dark(#4338ca,#a5b4fc);--_improved:light-dark(#065f46,#6ee7b7);--_fixed:light-dark(#92400e,#fcd34d)`

const CONTENT = `:host([theme=light]){color-scheme:light}:host([theme=dark]){color-scheme:dark}
:focus-visible{outline:2px solid var(--_a);outline-offset:2px}
.tag{padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600;color:var(--_t,var(--_new));background:color-mix(in srgb,var(--_t,var(--_new)) 14%,transparent)}
.improved{--_t:var(--_improved)}.fixed{--_t:var(--_fixed)}
.b{overflow-wrap:anywhere}.b p,.b ul,.b ol,.b pre{margin:0 0 8px}.b>:last-child{margin-bottom:0}
.b h3,.b h4{margin:12px 0 4px;font-size:14px}.b ul,.b ol{padding-left:20px}
.b a,.more{color:var(--_a);font-weight:600}
.b code{font-size:.9em;padding:1px 4px;border-radius:4px;background:color-mix(in srgb,var(--_fg) 8%,transparent)}
.b pre{overflow:auto;padding:8px;border-radius:8px;background:color-mix(in srgb,var(--_fg) 8%,transparent)}
.b pre code{padding:0;background:none}
.b img,.img{display:block;max-width:100%;height:auto;margin:8px 0;border-radius:8px}
.more{display:inline-block;margin-top:8px}
@media (prefers-reduced-motion:no-preference){.popover:popover-open,.modal[open],.tip{animation:sd-f .15s ease-out}}
@keyframes sd-f{from{opacity:0;scale:.97}}`

// Forced colors (Windows High Contrast) paint backgrounds with the page color, which would
// hide the badge and the dots. Last in each sheet so it wins over `all:unset`.
const FORCED = `@media (forced-colors:active){.badge,.dot,.u .m::after{forced-color-adjust:none}.badge{background:Highlight;color:HighlightText}.dot::before,.u .m::after{background:Highlight;box-shadow:0 0 0 2px Canvas}.dot::after{border-color:Highlight}.tag,.ok{border:1px solid}}`

export const HOST_CSS: string = `:host{${VARS};display:inline-block;position:relative}${CONTENT}
.trigger{all:unset;position:relative;display:inline-grid;place-items:center;box-sizing:border-box;width:var(--shipdot-trigger-size,40px);height:var(--shipdot-trigger-size,40px);border-radius:50%;cursor:pointer}
.trigger:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
.badge{position:absolute;top:2px;right:0;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:var(--_a);color:var(--_ac);font:700 11px/18px system-ui,sans-serif;text-align:center}
.badge[hidden]{display:none}
.panel{box-sizing:border-box;margin:0;padding:0;border:1px solid var(--_bd);background:var(--_bg);color:var(--_fg);box-shadow:var(--_sh);overflow:auto;overscroll-behavior:contain}
.popover{position:fixed;inset:auto;width:min(var(--shipdot-panel-width,380px),calc(100vw - 16px));border-radius:var(--_r)}
.modal{width:min(560px,calc(100vw - 32px));max-height:min(80vh,720px);border-radius:var(--_r)}
.drawer{margin:0 0 0 auto;width:min(var(--shipdot-panel-width,420px),100vw);height:100%;max-height:none;border-width:0 0 0 1px}
dialog::backdrop{background:rgb(0 0 0/.4)}
@media (prefers-reduced-motion:no-preference){.drawer[open]{animation:sd-in .2s ease-out}}
@keyframes sd-in{from{transform:translateX(100%)}}
header{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--_bg);border-bottom:1px solid var(--_bd)}
h2{margin:0;font-size:16px;font-weight:600}
.x{all:unset;display:grid;place-items:center;width:32px;height:32px;border-radius:8px;font-size:22px;line-height:1;color:var(--_mu);cursor:pointer}
.x:hover{background:color-mix(in srgb,var(--_fg) 8%,transparent)}
ul.l{list-style:none;margin:0;padding:0}
.e{padding:16px;border-bottom:1px solid var(--_bd)}.e:last-child{border:0}
.m{display:flex;align-items:center;gap:8px;color:var(--_mu);font-size:12px}
.u .m::after{content:"";width:8px;height:8px;margin-left:auto;border-radius:50%;background:var(--_a)}
.h{margin:8px 0 4px;font-size:15px;font-weight:600}
.empty{padding:32px 16px;text-align:center;color:var(--_mu)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}${FORCED}`

export const LAYER_CSS: string = `:host{${VARS};position:fixed;inset:0;pointer-events:none;z-index:var(--shipdot-z,2147483000)}${CONTENT}
.dot{all:unset;position:fixed;left:0;top:0;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;pointer-events:auto;cursor:pointer}
.dot[hidden]{display:none}
.dot::before{content:"";width:12px;height:12px;border-radius:50%;background:var(--_hs);box-shadow:0 0 0 2px var(--_bg)}
.dot::after{content:"";position:absolute;inset:6px;border:2px solid var(--_hs);border-radius:50%;animation:sd-p 1.6s ease-out infinite}
@keyframes sd-p{to{transform:scale(2.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.dot::after{animation:none;transform:scale(1.6);opacity:.5}}
.tip{position:fixed;left:0;top:0;box-sizing:border-box;width:min(320px,calc(100vw - 16px));padding:16px;pointer-events:auto;background:var(--_bg);color:var(--_fg);border:1px solid var(--_bd);border-radius:var(--_r);box-shadow:var(--_sh)}
.tt{margin:8px 0 4px;font-size:15px;font-weight:600}
.ok{all:unset;display:block;width:fit-content;margin-top:12px;padding:6px 14px;border-radius:8px;background:var(--_a);color:var(--_ac);font-weight:600;cursor:pointer}${FORCED}`

/** Custom properties copied onto the hotspot layer, which lives outside `<ship-dot>`. */
export const THEME_PROPS: string[] = [
  'accent',
  'accent-contrast',
  'hotspot',
  'bg',
  'fg',
  'muted',
  'border',
  'radius',
  'shadow',
  'font',
  'z',
]
