import {spawnSync} from 'node:child_process';
const result=spawnSync('npm',['ci'],{stdio:'inherit'});process.exit(result.status??1);
