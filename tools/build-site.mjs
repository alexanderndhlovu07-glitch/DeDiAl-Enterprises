import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = process.argv[2];
if(!['landing','platform'].includes(site)) throw new Error('Choose landing or platform.');
const setting = site==='landing'?'PLATFORM_URL':'LANDING_URL';
const value = process.env[setting];
if(!value) throw new Error(`${setting} must point to the other deployed site. Set it in Vercel environment settings.`);
const url = new URL(value);
if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/') {
  throw new Error(`${setting} must be an HTTPS site origin without credentials, query or fragment.`);
}
const directory=path.join(root,site), out=path.join(directory,'dist');
// Validate required settings before replacing any previous successful build.
const files = site==='landing'
  ? ['index.html','assets','styles.css','feature-section.css','design-evolution.css','script.js','water-effects.js','experience-previews.js','feature-section.js','design-evolution.js']
  : ['index.html','src','public'];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of files) await cp(path.join(directory,file),path.join(out,file),{recursive:true});
const config=site==='landing'?{platformUrl:url.href}:{landingUrl:url.href};
await writeFile(path.join(out,'config.js'),`window.DEDIAL_CONFIG=Object.freeze(${JSON.stringify(config)});\n`);
// Check the deployable entry point rather than assuming files were copied correctly.
const html=await readFile(path.join(out,'index.html'),'utf8');
if(!html.includes('config.js')) throw new Error('Entry page must load runtime navigation configuration.');
console.log(`Built ${site}/dist with ${setting}=${url.origin}.`);
