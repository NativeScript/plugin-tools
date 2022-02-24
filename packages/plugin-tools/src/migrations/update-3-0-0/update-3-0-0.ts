import { formatFiles, generateFiles, getProjects, getWorkspaceLayout, joinPathFragments, readJson, readProjectConfiguration, readWorkspaceConfiguration, removeProjectConfiguration, Tree, updateJson, updateProjectConfiguration } from '@nrwl/devkit';
import { convertToNxProjectGenerator } from '@nrwl/workspace';
import { relative } from 'path';

export default async function (tree: Tree) {
  updateDependencies(tree);
  removeAllPackage(tree);
  migrateEslint(tree);
  updateTsConfigPaths(tree);
  updateProjectTargets(tree);
  addResourcesPodfile(tree);
  // TODO: Edit the generators to use the new tsconfig
  doNxMigrations(tree);
  migrateNgPackagr(tree);

  // updateDemoAppPackages(tree);

  // Last Step, migrate plugin workspace to nx-project config style
  convertToNxProjectGenerator(tree, {
    all: true,
  });

  await formatFiles(tree);

  console.log(`\n   NOTE: Your plugin workspace is now migrated. Run this to finish the dependency cleanup:`);
  console.log(`\n`);
  console.log(`      npm run setup`);
  console.log(`\n`);
  console.log(`   This will ensure your workspace is properly reset with all the updates.`);
  console.log(`   It is also recommended to clean all your demo apps.`);
  console.log(`\n`);
}

function updateDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    if (json.devDependencies['@angular/core']) {
      json.devDependencies['@angular-devkit/build-angular'] = '^13.2.0';
      for (const key in json.devDependencies) {
        if (key.indexOf('@angular') > -1) {
          json.devDependencies[key] = '^13.2.0';
        }
      }
    }
    json.devDependencies['@nativescript/angular'] = '^13.0.0';
    json.devDependencies['@nativescript/core'] = 'alpha';
    json.devDependencies['@nativescript/types'] = '^8.1.0';
    json.devDependencies['@ngtools/webpack'] = '^13.0.0';
    json.devDependencies['husky'] = '^7.0.0';
    json.devDependencies['nativescript-permissions'] = '1.3.11';
    json.devDependencies['ng-packagr'] = '^13.2.0';
    json.devDependencies['rxjs'] = '~7.5.0';

    json.devDependencies['@nativescript/webpack'] = '~5.0.0';
    json.devDependencies['typescript'] = '~4.5.5';
    return json;
  });
}

function removeAllPackage(tree: Tree) {
  // remove the "all" package (we are moving everyone to nx run-many)
  removeProjectConfiguration(tree, 'all');
  // update all references to the all package (mostly from the helper scripts)
  let workspaceScripts = tree.read('tools/workspace-scripts.js', 'utf-8');
  workspaceScripts = workspaceScripts.replace(`'nx run all:focus'`, `'nx g @nativescript/plugin-tools:focus-packages'`);
  workspaceScripts = workspaceScripts.replace(`'nx run all:build'`, `'nx run-many --target=build.all --all'`);
  tree.write('tools/workspace-scripts.js', workspaceScripts);
}

function migrateEslint(tree: Tree) {
  // remove old legacy eslint
  tree.delete(`.eslintrc`);
  // update root .eslintrc > .eslintrc.json
  generateFiles(tree, joinPathFragments(__dirname, 'files_root'), '.', { dot: '.' });

  // for all apps and packages add .eslintrc
  getProjects(tree).forEach((project, name) => {
    generateFiles(tree, joinPathFragments(__dirname, 'files_project'), project.root, { dot: '.' });
    // for all packages that have angular implementations add a custom .eslintrc inside the angular/ folder that extends the package's eslint
    if (tree.exists(joinPathFragments(project.root, 'angular'))) {
      generateFiles(tree, joinPathFragments(__dirname, 'files_angular'), joinPathFragments(project.root, 'angular'), { dot: '.' });
    }
  });
}

function updateTsConfigPaths(tree: Tree) {
  // remove from the root tsconfig the paths: "@scope/*": "packages/*",
  // add to the root tsconfig, for every package: "@scope/package": "packages/package/index.ts",
  // add to the root tsconfig, for every package with angular: "@scope/package/angular": "packages/package/angular/index.ts"
  // on apps' tsconfig.json, change paths to be { "~/": "app/*", ...all the things from the root tsconfig paths }
  const scope = getWorkspaceLayout(tree).npmScope;
  // TODO handle scope/noscope
  const rootPaths: { [key: string]: string[] } = {};
  getProjects(tree).forEach((project, name) => {
    if (project.projectType === 'library') {
      const packageJson = readJson(tree, joinPathFragments('packages', name, 'package.json'));
      const packageName = packageJson.name;
      const packageMain = packageJson.main || packageJson.typings || 'index';
      const indexFile = [`${packageMain}`, `${packageMain}.d.ts`, `${packageMain}.ts`, 'index.d.ts', 'index.ts'].find((f) => tree.exists(joinPathFragments('packages', name, f))) || 'index.d.ts';
      rootPaths[`${packageName}`] = [`packages/${name}/${indexFile}`];
      if (tree.exists(joinPathFragments(project.root, 'angular'))) {
        rootPaths[`${packageName}/angular`] = [`packages/${name}/angular/index.ts`];
      }
    }
  });
  updateJson(tree, 'tsconfig.base.json', (json) => {
    json.compilerOptions = json.compilerOptions || {};
    json.compilerOptions.paths = json.compilerOptions.paths || {};
    delete json.compilerOptions.paths[`@${scope}/*`];
    delete json.compilerOptions.paths[`nativescript-*`];
    json.compilerOptions.paths = { ...json.compilerOptions.paths, ...rootPaths };
    json.compilerOptions.lib = json.compilerOptions.lib || [];
    if (json.compilerOptions.lib && json.compilerOptions.lib.length > 0 && !json.compilerOptions.lib.find((l) => l.toLowerCase() === 'dom')) {
      json.compilerOptions.lib = [...(json.compilerOptions.lib || []), 'dom'];
    }
    return json;
  });
  getProjects(tree).forEach((project, name) => {
    if (project.projectType === 'application') {
      if (!tree.exists(joinPathFragments(project.root, 'tsconfig.json'))) {
        return;
      }
      updateJson(tree, joinPathFragments(project.root, 'tsconfig.json'), (json) => {
        if (!json.compilerOptions?.paths) {
          return json;
        }
        delete json.compilerOptions.paths[`@${scope}/*`];
        delete json.compilerOptions.paths[`nativescript-*`];
        if (name.indexOf('angular') > -1) {
          delete json.compilerOptions.rootDirs;
          delete json.compilerOptions.baseUrl;
          // since we no longer set rootDirs, we need the absolute paths
          json.compilerOptions.paths = { ...json.compilerOptions.paths, ...rootPaths };
          let demoShared: string[] = json.compilerOptions.paths['@demo/shared'] || [];
          demoShared = demoShared.map((v) => (v.startsWith('../../') ? v.replace('../../', '') : v));
          if (demoShared.length > 0) {
            json.compilerOptions.paths['@demo/shared'] = demoShared;
          }
          json.include = json.include || [];
          json.include.push('../../packages/**/references.d.ts'); //include the packages reference files
        } else {
          const relativePaths = {};
          for (const k of Object.keys(rootPaths)) {
            relativePaths[k] = rootPaths[k].map((p) => relative(project.root, p));
          }
          json.compilerOptions.paths = { ...json.compilerOptions.paths, ...relativePaths };
        }
        return json;
      });
    }
  });
}

function updateProjectTargets(tree: Tree) {
  // make sure build.all is cacheable
  getProjects(tree).forEach((project, name) => {
    if (project.projectType === 'application') {
      return;
    }
    const projectConfig = readProjectConfiguration(tree, name);
    if (projectConfig.targets?.['build.all']) {
      projectConfig.targets['build.all'].outputs = projectConfig.targets['build.all'].outputs || [];
      projectConfig.targets['build.all'].outputs = [`dist/packages/${name}`];
    }
    if (projectConfig.targets?.['focus']) {
      delete projectConfig.targets['focus'].outputs;
    }
    updateProjectConfiguration(tree, name, projectConfig);
  });

  // add "lint" target and "dependsOn" to all projects
  getProjects(tree).forEach((project, name) => {
    project.targets = project.targets || {};
    project.targets['lint'] = project.targets['lint'] || {
      executor: '@nrwl/linter:eslint',
      options: {
        lintFilePatterns: [joinPathFragments(project.root, '**', '*.ts')],
      },
    };
    const targets = project.projectType === 'application' ? new Set(['build', 'test', 'android', 'ios']) : new Set(['build', 'build.all']);
    for (const target of Object.keys(project.targets)) {
      if (!targets.has(target)) {
        continue;
      }
      // if (target === 'build.native') {
      //   project.targets[target].outputs = [joinPathFragments(project.root, 'platforms')];
      // }
      project.targets[target].dependsOn = project.targets[target].dependsOn || [];
      project.targets[target].dependsOn.push({
        target: 'build.all',
        projects: 'dependencies',
      });
      const additionalDeps = [];
      if (project.targets[target].executor === '@nrwl/workspace:run-commands') {
        if (project.targets[target].options?.commands) {
          const newCommands = [...project.targets[target].options.commands];
          for (const cmd of <string[]>project.targets[target].options.commands) {
            const matches = cmd.match(/^nx run ([^\s]*?):([^\s:]*?)$/);
            if (!matches) {
              break;
            }
            newCommands.shift();
            additionalDeps.push({
              target: matches[2],
              projects: matches[1] === name ? 'self' : matches[1],
            });
          }
          project.targets[target].options.commands = newCommands;
        }
      }
      project.targets[target].dependsOn.push(...additionalDeps);
    }
    updateProjectConfiguration(tree, name, project);
  });
}

function addResourcesPodfile(tree: Tree) {
  if (!tree.exists('tools/assets/App_Resources/iOS/Podfile')) {
    generateFiles(tree, joinPathFragments(__dirname, 'files_podfile'), 'tools/assets/App_Resources/iOS', { dot: '.' });
  }
}

function doNxMigrations(tree: Tree) {
  // TODO: should we do this or call nx migrations?
  updateJson(tree, 'nx.json', (json) => {
    delete json.projects;
    json.tasksRunnerOptions = json.tasksRunnerOptions || {
      default: {
        runner: '@nrwl/workspace/tasks-runners/default',
        options: {
          cacheableOperations: ['build', 'build.all', 'lint', 'test', 'e2e'],
          runtimeCacheInputs: ['node -v'],
        },
      },
    };
    return json;
  });
}

function migrateNgPackagr(tree: Tree) {
  // ng-packagr migration
  const rootLibs: string[] = readJson(tree, 'tsconfig.base.json')?.compilerOptions?.lib || [];
  getProjects(tree).forEach((project) => {
    if (project.projectType === 'application' || !tree.exists(joinPathFragments(project.root, 'angular', 'package.json')) || tree.exists(joinPathFragments(project.root, 'angular', 'ng-package.json'))) {
      return;
    }
    const oldPackage = readJson(tree, joinPathFragments(project.root, 'angular', 'package.json'));
    // tree.delete(joinPathFragments(project.root, 'angular', 'package.json'));
    updateJson(tree, joinPathFragments(project.root, 'angular', 'package.json'), (json) => {
      delete json.ngPackage;
      return json;
    });
    tree.write(joinPathFragments(project.root, 'angular', 'ng-package.json'), `{}`);
    updateJson(tree, joinPathFragments(project.root, 'angular', 'ng-package.json'), (json) => {
      json.$schema = relative(joinPathFragments(project.root, 'angular'), 'node_modules/ng-packagr/ng-package.schema.json');
      json.lib = {};
      json.lib.entryFile = oldPackage?.ngPackage?.entryFile || 'index.ts';
      json.allowedNonPeerDependencies = oldPackage?.ngPackage?.allowedNonPeerDependencies || ['.'];
      const distFolder = relative(joinPathFragments(project.root, 'angular'), joinPathFragments('dist', project.root, 'angular'));
      json.dest = json.dest || distFolder;
      return json;
    });
    updateJson(tree, joinPathFragments(project.root, 'angular', 'tsconfig.json'), (json) => {
      json.compilerOptions = json.compilerOptions || {};
      // ensure we have the "dom" lib for angular at any costs
      if (!json.compilerOptions.lib && rootLibs.length > 0 && !rootLibs.find((l) => l.toLowerCase() === 'dom')) {
        json.compilerOptions.lib = [...rootLibs, 'dom'];
      }
      return json;
    });
    updateJson(tree, joinPathFragments(project.root, 'angular', 'tsconfig.angular.json'), (json) => {
      if ((json.extends as string)?.indexOf('ng-packagr/lib/ts/conf/tsconfig.ngc.json') == -1) {
        return;
      }

      const distFolder = relative(joinPathFragments(project.root, 'angular'), joinPathFragments('dist', 'out-tsc'));
      json.compilerOptions = json.compilerOptions || {};
      json.compilerOptions.outDir = json.compilerOptions.outDir || distFolder;
      json.compilerOptions.declarationDir = json.compilerOptions.declarationDir || distFolder;
      // TODO: we can set this if we want to support angular 11 or lower
      // WITHOUT THIS LINE ONLY ANGULAR 12 AND ABOVE WILL WORK
      // json.angularCompilerOptions = json.angularCompilerOptions || {};
      // json.angularCompilerOptions.compilationMode = json.angularCompilerOptions.compilationMode || 'full';

      json.files = json.files || [oldPackage?.ngPackage?.entryFile || 'index.ts'];
      return json;
    });
  });

  const buildFinishPath = joinPathFragments('tools', 'scripts', 'build-finish.ts');
  if (tree.exists(buildFinishPath)) {
    let contents = tree.read(buildFinishPath, 'utf-8');
    contents = contents.replace(`.forProject(path.join('packages', packageName, 'angular', 'package.json'))`, `.forProject(path.join('packages', packageName, 'angular', 'ng-package.json'))`);
    contents = contents.replace('copyAngularDist();', 'console.log(`${npmPackageName} angular built successfully.`);\nfinishPreparation();');

    tree.write(buildFinishPath, contents);
  }
}

function updateDemoAppPackages(tree: Tree) {
  const appFolders = tree.children('apps');
  for (const dir of appFolders) {
    if (dir.indexOf('demo') > -1) {
      const appDir = `apps/${dir}`;

      // update demo app deps
      const packagePath = `${appDir}/package.json`;
      if (tree.exists(packagePath)) {
        const packageJson = readJson(tree, packagePath);
        if (packageJson.devDependencies) {
          let hasNativeScriptRuntimes = false;
          for (const d in packageJson.devDependencies) {
            if (d.indexOf('@nativescript') > -1) {
              hasNativeScriptRuntimes = true;
              break;
            }
          }
          if (!hasNativeScriptRuntimes) {
            // not a {N} demo app
            return;
          }
        } else {
          // {N} demo app should have runtimes in devDependencies at least
          return;
        }

        updateJson(tree, packagePath, (packageJson) => {
          packageJson.devDependencies = {
            ...(packageJson.devDependencies || {}),
            '@nativescript/android': '~8.1.1',
            '@nativescript/ios': '~8.1.0',
          };

          return packageJson;
        });
      }
    }
  }
}
