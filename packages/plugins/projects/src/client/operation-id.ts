/** getRandomValues is available on the existing HTTP intranet deployment too. */
export function projectOperationId(prefix='project-task'): string {
  const bytes=new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('')}`;
}
