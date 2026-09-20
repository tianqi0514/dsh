import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-host-webserver';
import { injectFileUploadTransport } from './file-upload-transport.js';

/** Product diagnostics only. Feature packages are installed as separate Profile layers. */
export const name = 'workdsh-installation-probe';
export const inject = ['webServer'];

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.tapIndex(injectFileUploadTransport));
  ctx.effect(() => {
    process.stdout.write('[workdsh:probe] activated\n');
    return () => process.stdout.write('[workdsh:probe] disposed\n');
  });
}
