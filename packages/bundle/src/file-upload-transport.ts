const MARKER = 'data-workdsh-file-upload-transport="fetch-v1"';

/**
 * Install the official DSH page-owned upload carrier before Cordis boots.
 *
 * DSH 0.1.6's fallback Blob Worker revokes its object URL immediately after
 * construction. Some Chromium builds fail the worker load in that window, so
 * the raw upload route is never reached. The public `__DSH_FILE_UPLOAD__` hook
 * is the supported escape hatch for pages that need to own the carrier.
 */
export function injectFileUploadTransport(html: string): string {
  if (html.includes(MARKER)) return html;
  const script = `<script ${MARKER}>(function(){if(globalThis.__DSH_FILE_UPLOAD__!==undefined)return;const pageFetch=globalThis.fetch.bind(globalThis);globalThis.__DSH_FILE_UPLOAD__={fetch:function(input,init){const options=Object.assign({},init);if(options.credentials===undefined)options.credentials='include';return pageFetch(input,options);}};})();</script>`;
  const headEnd = html.search(/<\/head\s*>/i);
  return headEnd === -1 ? `${script}${html}` : `${html.slice(0, headEnd)}${script}${html.slice(headEnd)}`;
}
