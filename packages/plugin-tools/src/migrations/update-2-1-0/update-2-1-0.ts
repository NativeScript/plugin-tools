import { Tree } from '@nrwl/devkit';
import { join } from 'path';
import * as fs from 'fs';

export default async function (tree: Tree) {
  const cwd = process.cwd();
  const buildFinishPath = join(cwd, 'tools', 'scripts', 'build-finish.ts');
  // console.log('webpackConfigPath:', webpackConfigPath);
  const buildFinishUpdatePath = join(cwd, `node_modules/@nativescript/plugin-tools/src/migrations/update-2-1-0/_files/build-finish`);
  // console.log('webpackConfigPath:', webpackConfigPath);
  const buildFinish = fs.readFileSync(buildFinishPath, {
    encoding: 'utf-8',
  });
  const buildFinishUpdate = fs.readFileSync(buildFinishUpdatePath, {
    encoding: 'utf-8',
  });
  if (buildFinish && buildFinishPath) {
    tree.write(buildFinishPath, buildFinishUpdate);
  }
}
