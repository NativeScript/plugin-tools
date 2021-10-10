import { getJsonFromFile } from '../../utils';
import { Schema } from './schema';
import { stringUtils, serializeJson } from '@nrwl/workspace';
import { Tree, updateJson, writeJson } from '@nrwl/devkit';

let customNpmScope: string;
let gitRepo = 'https://github.com/NativeScript/plugins';
let gitAuthorName = 'NativeScript';
let gitAuthorEmail = 'oss@nativescript.org';
export default async function (tree: Tree, schema: Schema) {
  customNpmScope = stringUtils.dasherize(schema.scope);
  if (schema.repo) {
    const repo = schema.repo.replace('.git', '');
    gitRepo = repo.trim();
  }
  if (schema.gitAuthorName) {
    gitAuthorName = schema.gitAuthorName.trim();
  }
  if (schema.gitAuthorEmail) {
    gitAuthorEmail = schema.gitAuthorEmail.trim();
  }

  // package.json settings that apply to all new packages added to workspace
  const toolsPackageSettingsPath = 'tools/package-settings.json';
  const packageSettings = {
    repository: {
      type: 'git',
      url: `${gitRepo}.git`,
    },
    keywords: ['NativeScript', 'JavaScript', 'TypeScript', 'iOS', 'Android'],
    author: {
      name: gitAuthorName,
      email: gitAuthorEmail,
    },
    bugs: {
      url: `${gitRepo}/issues`,
    },
    license: 'Apache-2.0',
    homepage: gitRepo,
  };
  if (!tree.exists(toolsPackageSettingsPath)) {
    writeJson(tree, toolsPackageSettingsPath, packageSettings);
  } else {
    updateJson(tree, toolsPackageSettingsPath, (json) => {
      if (!json.repository) {
        json.repository = {
          type: 'git'
        };
      }
      json.repository.url = packageSettings.repository.url;
      if (!json.author) {
        json.author = {};
      }
      json.author.name = packageSettings.author.name;
      json.author.email = packageSettings.author.email;
      if (!json.bugs) {
        json.bugs = {};
      }
      json.bugs.url = packageSettings.bugs.url;
      json.homepage = packageSettings.homepage;

      return json;
    });
  }

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
