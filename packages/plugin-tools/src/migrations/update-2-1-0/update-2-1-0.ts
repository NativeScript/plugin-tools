import { Tree, updateJson } from '@nrwl/devkit';
import { join } from 'path';
import * as fs from 'fs';

export default async function (tree: Tree) {
  const cwd = process.cwd();
  // update build-finish to support non-scoped npm names
  const buildFinishPath = join(cwd, 'tools', 'scripts', 'build-finish.ts');
  const buildFinishUpdatePath = join(cwd, `node_modules/@nativescript/plugin-tools/src/migrations/update-2-1-0/_files/build-finish`);
  const buildFinish = fs.readFileSync(buildFinishPath, {
    encoding: 'utf-8',
  });
  const buildFinishUpdate = fs.readFileSync(buildFinishUpdatePath, {
    encoding: 'utf-8',
  });
  if (buildFinish && buildFinishPath) {
    tree.write('tools/scripts/build-finish.ts', buildFinishUpdate);
  }

  // update jest.config to latest config
  const jestConfigPath = join(cwd, 'jest.config.js');
  const jestConfigUpdatePath = join(cwd, `node_modules/@nativescript/plugin-tools/src/migrations/update-2-1-0/_files/jest.config`);
  const jestConfig = fs.readFileSync(jestConfigPath, {
    encoding: 'utf-8',
  });
  const jestConfigUpdate = fs.readFileSync(jestConfigUpdatePath, {
    encoding: 'utf-8',
  });
  if (jestConfig && jestConfigUpdate) {
    tree.write('jest.config.js', jestConfigUpdate);
  }

  updateJson(tree, 'package.json', (json) => {
    json.devDependencies['typescript'] = '4.3.5';
    return json;
  });
}
