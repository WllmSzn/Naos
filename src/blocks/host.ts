import type { Mode } from '../modes/modes.js';
import type { Block } from './library.js';

/**
 * Section hôte d'un bloc : un fragment n'a ni titre ni cadre à lui, il emprunte ceux
 * de la section qui l'accueille. Pour le lint, la démo et l'audit, il faut donc lui
 * fabriquer une section minimale, dans le cadre du mode (frameSelector) et à la
 * hauteur de son premier viewport, afin que le débordement soit mesuré pour de vrai.
 */

/** Attribut de cadre du mode, quand le sélecteur est un simple attribut (« [data-slide] »). */
export function frameAttribute(mode: Mode): string {
  const m = mode.preview.frameSelector?.trim().match(/^\[([a-z][a-z0-9-]*)\]$/);
  return m?.[1] ?? '';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function hostSection(block: Block, mode: Mode, titleClass = ''): string {
  const frame = frameAttribute(mode);
  const height = mode.viewports[0]?.height;
  const size = height ? ` h-[${height}px] overflow-hidden` : '';
  return (
    `<section${frame ? ` ${frame}` : ''} class="flex flex-col gap-10 bg-base p-24${size}">\n` +
    `  <h2 class="font-display text-ink${titleClass ? ` ${titleClass}` : ''}">${escapeHtml(block.name)}</h2>\n` +
    `  <div class="min-w-0 flex-1">\n${block.html}\n  </div>\n` +
    `</section>`
  );
}
