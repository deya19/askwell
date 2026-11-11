import { BUTTON_HEIGHT, EDGE_GAP, PANEL_GAP } from "./config";

/** Default panel height until the panel sends `resize`, in px. */
export const DEFAULT_PANEL_HEIGHT = 600;
/** Panel width on wide screens, in px. */
export const PANEL_WIDTH = 380;
/** Below this viewport width the panel fills the screen (task: "below 480 px"). */
export const FULL_SCREEN_BELOW = 480;

const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const PANEL_OFFSET = EDGE_GAP + BUTTON_HEIGHT + PANEL_GAP;
const Z = 2147483647;

/**
 * The only stylesheet the widget has. It lives in the shadow root, so it can't reach the host
 * page, and `:host { all: initial }` stops the page's inherited styles (font, color, …) from
 * reaching in. Config values arrive as custom properties (see `configStyleVars`), never as text.
 */
export const STYLES = `
:host{all:initial}
*,*::before,*::after{box-sizing:border-box}
.btn{position:fixed;top:var(--aw-btn-top);bottom:var(--aw-btn-bottom);left:var(--aw-btn-left);right:var(--aw-btn-right);z-index:${Z};
display:inline-flex;align-items:center;gap:8px;height:${BUTTON_HEIGHT}px;max-width:calc(100vw - ${EDGE_GAP * 2}px);margin:0;padding:0 20px 0 16px;
border:0;border-radius:999px;background:var(--aw-color);color:var(--aw-text);font:600 15px/1 ${FONT};letter-spacing:normal;text-transform:none;
cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.12);transition:transform .15s ease,box-shadow .15s ease}
.btn:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.22),0 2px 6px rgba(0,0,0,.12)}
.btn:focus{outline:none}
.btn:focus-visible{outline:3px solid var(--aw-color);outline-offset:3px}
.btn svg{flex:none;width:22px;height:22px}
.label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.badge{position:absolute;top:-6px;right:-6px;min-width:22px;height:22px;padding:0 6px;border:2px solid #fff;border-radius:11px;
background:#e5484d;color:#fff;font:700 11px/18px ${FONT};text-align:center}
.badge[hidden]{display:none}
.panel{position:fixed;top:var(--aw-panel-top);bottom:var(--aw-panel-bottom);left:var(--aw-panel-left);right:var(--aw-panel-right);z-index:${Z};
width:${PANEL_WIDTH}px;max-width:calc(100vw - ${EDGE_GAP * 2}px);height:min(var(--aw-h,${DEFAULT_PANEL_HEIGHT}px),calc(100vh - ${PANEL_OFFSET + EDGE_GAP}px));
border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 24px 64px rgba(0,0,0,.24),0 4px 12px rgba(0,0,0,.1);
opacity:0;visibility:hidden;pointer-events:none;transform-origin:var(--aw-origin);
transition:opacity .2s ease,transform .2s ease,visibility 0s linear .2s}
.slide .panel{transform:translateY(var(--aw-slide))}
.scale .panel{transform:scale(.92)}
.open .panel{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition:opacity .2s ease,transform .2s ease,visibility 0s}
iframe{display:block;width:100%;height:100%;border:0;background:transparent}
@media (max-width:${FULL_SCREEN_BELOW - 0.02}px){
.panel{top:0;bottom:0;left:0;right:0;width:auto;max-width:none;height:auto;border-radius:0}
.open .btn{display:none}
}
@media (prefers-reduced-motion:reduce){.btn,.panel,.open .panel{transition:none}.btn:hover{transform:none}}
`;
