import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
for(const [site,setting,target] of [['landing','PLATFORM_URL','https://platform.preview.test/'],['platform','LANDING_URL','https://landing.preview.test/']]) {
  test(`${site} build uses explicit navigation and excludes server/secrets`,async()=>{
    const result=spawnSync(process.execPath,['tools/build-site.mjs',site],{cwd:root,env:{...process.env,[setting]:target},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const folder=path.join(root,site,'dist');
    const config=await readFile(path.join(folder,'config.js'),'utf8');
    assert.ok(config.includes(target));
    await access(path.join(folder,'index.html'));
    for(const excluded of ['server','api','.env.example','package.json']) {
      await assert.rejects(access(path.join(folder,excluded)));
    }
  });
  test(`${site} build fails safely for missing or unsafe navigation settings`,()=>{
    for(const value of ['', 'http://unsafe.test','https://user:password@other.test','https://other.test/#login','https://other.test/path']) {
      const result=spawnSync(process.execPath,['tools/build-site.mjs',site],{cwd:root,env:{...process.env,[setting]:value},encoding:'utf8'});
      assert.notEqual(result.status,0);
    }
  });
}
