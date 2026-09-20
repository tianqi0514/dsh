import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../packages/plugins/plate/',import.meta.url);
await mkdir(new URL('dist/',root),{recursive:true});
const result = await build({entryPoints:[fileURLToPath(new URL('src/client.tsx',root))],bundle:true,write:false,format:'cjs',platform:'browser',target:'es2022',define:{'process.env.NODE_ENV':'"production"'},external:['react','react/jsx-runtime','react-dom','react-dom/client']});
await writeFile(new URL('dist/client.browser.js',root), `window.__ModuleLoader__.load({id:"workdsh-plugin-plate",factory:function(require){const module={exports:{}};\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`);
