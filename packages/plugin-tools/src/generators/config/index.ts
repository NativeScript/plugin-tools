import { getJsonFromFile } from '../../utils';
import { Schema } from './schema';
import { stringUtils, serializeJson } from '@nrwl/workspace';
import { Tree } from '@nrwl/devkit';

let customNpmScope: string;
export default async function (tree: Tree, schema: Schema) {
  customNpmScope = stringUtils.dasherize(schema.scope);

  const nxConfigPath = `nx.json`;
  const nxConfig = getJsonFromFile(tree, nxConfigPath);
  if (nxConfig && nxConfig.npmScope) {
    nxConfig.npmScope = customNpmScope;
    tree.write(nxConfigPath, serializeJson(nxConfig));
  }

  const tsconfigBasePath = `tsconfig.base.json`;
  const tsconfigBase = getJsonFromFile(tree, tsconfigBasePath);
  if (tsconfigBase && tsconfigBase.compilerOptions && tsconfigBase.compilerOptions.paths) {
    delete tsconfigBase.compilerOptions.paths[`@nativescript/*`];
    tsconfigBase.compilerOptions.paths[`@${customNpmScope}/*`] = ['packages/*'];
    tree.write(tsconfigBasePath, serializeJson(tsconfigBase));
  }

  // apps
  const appFolders = tree.children('apps');
  for (const dir of appFolders) {
    const demoTsConfigPath = `apps/${dir}/tsconfig.json`;
    if (tree.exists(demoTsConfigPath)) {
      const demoTsConfig = getJsonFromFile(tree, demoTsConfigPath);
      // console.log(`demoTsConfig:`, demoTsConfig);

      if (demoTsConfig && demoTsConfig.compilerOptions && demoTsConfig.compilerOptions.paths) {
        delete demoTsConfig.compilerOptions.paths[`@nativescript/*`];
        demoTsConfig.compilerOptions.paths[`@${customNpmScope}/*`] = [`../../${dir.indexOf('angular') > -1 ? 'dist/' : ''}packages/*`];
        tree.write(demoTsConfigPath, serializeJson(demoTsConfig));
      }
    }
  }

  const travisPath = `.travis.yml`;
  let travisContent = tree.read(travisPath).toString('utf-8');
  travisContent = travisContent.replace(/@nativescript/gm, `@${customNpmScope}`);
  // context.logger.info('travisContent:' + travisContent);
  tree.write(travisPath, travisContent);

  const workspaceScriptsPath = `tools/workspace-scripts.js`;
  let workspaceScripts = tree.read(workspaceScriptsPath).toString('utf-8');
  workspaceScripts = workspaceScripts.replace(/@nativescript/gm, `@${customNpmScope}`);
  // context.logger.info(travisContent);
  tree.write(workspaceScriptsPath, workspaceScripts);

  const sharedDemoTsConfigPath = `tools/demo/tsconfig.json`;
  let sharedDemoTsConfig = getJsonFromFile(tree, sharedDemoTsConfigPath);
  if (sharedDemoTsConfig && sharedDemoTsConfig.compilerOptions && sharedDemoTsConfig.compilerOptions.paths) {
    delete sharedDemoTsConfig.compilerOptions.paths[`@nativescript/*`];
    sharedDemoTsConfig.compilerOptions.paths[`@${customNpmScope}/*`] = [`../../packages/*`];
    tree.write(sharedDemoTsConfigPath, serializeJson(sharedDemoTsConfig));
  }

  const readmePath = `README.md`;
  let readme = tree.read(readmePath).toString('utf-8');
  const impNoteIndex = readme.indexOf('**===');
  if (impNoteIndex > -1) {
    const headingIndex = readme.indexOf('# @');
    if (headingIndex > -1) {
      readme = readme.substring(headingIndex, readme.length);
    }
  }
  readme = readme.replace(/@nativescript/gm, `@${customNpmScope}`);
  // context.logger.info(travisContent);
  tree.write(readmePath, readme);

  console.log(`Workspace has been configured for npm scope: @${customNpmScope}\n\n`);
}
