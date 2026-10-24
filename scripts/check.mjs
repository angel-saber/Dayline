import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function check(directory) {
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory())check(path);
    else if(entry.name.endsWith('.js')){
      const result=spawnSync(process.execPath,['--check',path.pathname],{stdio:'inherit'});
      if(result.status!==0)process.exit(result.status||1);
    }
  }
}
check(new URL('../dist/js/',import.meta.url));
check(new URL('../experiments/e2ee/',import.meta.url));
console.log('Application and experimental modules passed syntax checks.');
