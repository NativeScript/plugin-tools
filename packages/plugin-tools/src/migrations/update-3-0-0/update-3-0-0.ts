import { generateFiles, getProjects, getWorkspaceLayout, joinPathFragments, readJson, readProjectConfiguration, readWorkspaceConfiguration, removeProjectConfiguration, Tree, updateJson, updateProjectConfiguration } from '@nrwl/devkit';
import { convertToNxProjectGenerator } from '@nrwl/workspace';
import { readFile, readFileSync } from 'fs';
import { relative } from 'path';

export default async function (tree: Tree) {
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
    json.devDependencies['@nativescript/types'] = '^8.0.0';
    json.devDependencies['@ngtools/webpack'] = '^13.0.0';
    json.devDependencies['husky'] = '^7.0.0';
    json.devDependencies['nativescript-permissions'] = '1.3.11';
    json.devDependencies['ng-packagr'] = '^13.2.0';
    json.devDependencies['rxjs'] = '~7.5.0';

    json.devDependencies['@nativescript/webpack'] = '~5.0.0';
    json.devDependencies['typescript'] = '~4.5.5';
    return json;
  });

  // remove the "all" package (we are moving everyone to nx run-many)
  removeProjectConfiguration(tree, 'all');

  // remove old legacy eslint
  tree.delete(`.eslintrc`);
  // update root .eslintrc > .eslintrc.json
  tree.write(`.eslintrc.json`, readFileSync(joinPathFragments(__dirname, 'files', '.eslintrc.json'), 'utf8'));
  // generateFiles(tree, joinPathFragments(__dirname, 'files'), '.eslintrc.json', {});

  // for all apps and packages add .eslintrc
  getProjects(tree).forEach((project, name) => {
    tree.write(joinPathFragments(project.root, '.eslintrc.json'), readFileSync(joinPathFragments(__dirname, 'files', '.eslintrc.package.json'), 'utf8'));
    // for all packages that have angular implementations add a custom .eslintrc inside the angular/ folder that extends the package's eslint
    if (tree.exists(joinPathFragments(project.root, 'angular'))) {
      tree.write(joinPathFragments(project.root, 'angular', '.eslintrc.json'), readFileSync(joinPathFragments(__dirname, 'files', '.eslintrc.angular.json'), 'utf8'));
    }
  });

  // TODO: update all references to the all package (mostly from the helper scripts)

  // remove from the root tsconfig the paths: "@scope/*": "packages/*",
  // add to the root tsconfig, for every package: "@scope/package": "packages/package/index.ts",
  // add to the root tsconfig, for every package with angular: "@scope/package/angular": "packages/package/angular/index.ts"
  // on apps' tsconfig.json, change paths to be { "~/": "app/*", ...all the things from the root tsconfig paths }
  const libraries: string[] = [];
  const scope = getWorkspaceLayout(tree).npmScope;
  // TODO handle scope/noscope
  const rootPaths = {};
  getProjects(tree).forEach((project, name) => {
    if (project.projectType === 'library') {
      libraries.push(name);
      const packageMain = readJson(tree, joinPathFragments('packages', name, 'package.json')).main || 'index';
      const indexFile = [`${packageMain}`, `${packageMain}.d.ts`, `${packageMain}.ts`, 'index.d.ts', 'index.ts'].find((f) => tree.exists(joinPathFragments('packages', name, f))) || 'index.d.ts';
      rootPaths[`@${scope}/${name}`] = `packages/${name}/${indexFile}`;
    }
  });
  updateJson(tree, 'tsconfig.base.json', (json) => {
    delete json.compilerOptions.paths[`@${scope}/*`];
    json.compilerOptions.paths = { ...json.compilerOptions.paths, ...rootPaths };
    return json;
  });
  getProjects(tree).forEach((project, name) => {
    if (project.projectType === 'application') {
      updateJson(tree, joinPathFragments(project.root, 'tsconfig.json'), (json) => {
        delete json.compilerOptions.rootDirs; // TODO: check if this only needs to be removed in angular projects!
        delete json.compilerOptions.baseUrl; // TODO: check if this only needs to be removed in angular projects!
        delete json.compilerOptions.paths[`@${scope}/*`];
        const relativePaths = {};
        for (const k of Object.keys(rootPaths)) {
          relativePaths[k] = relative(project.root, rootPaths[k]);
        }
        json.compilerOptions.paths = { ...json.compilerOptions.paths, ...relativePaths };
        return json;
      });
    }
  });

  // make sure build.all is cacheable
  libraries.forEach((lib) => {
    const projectConfig = readProjectConfiguration(tree, lib);
    if (projectConfig.targets['build.all']) {
      projectConfig.targets['build.all'].outputs = projectConfig.targets['build.all'].outputs || [];
      if (!projectConfig.targets['build.all'].outputs.includes(`dist/packages/${lib}`)) {
        projectConfig.targets['build.all'].outputs.push(`dist/packages/${lib}`);
      }
    }
    updateProjectConfiguration(tree, lib, projectConfig);
  });


  // TODO: add "lint" target and "dependsOn" to all projects
  // TODO: add cache and overall improvements to the workspace.json (outputs, dependencies and some other stuff) - TODO: find exactly what these are
  // TODO: Edit the generators to no longer create the "all" link and also add the correct eslint files
  // TODO: Edit the generators to use the new tsconfig

  // updateDemoAppPackages(tree);

  // Last Step, migrate plugin workspace to nx-project config style
  convertToNxProjectGenerator(tree, {
    all: true,
  });

  console.log(`\n   NOTE: Your plugin workspace is now migrated. Run this to finish the dependency cleanup:`);
  console.log(`\n`);
  console.log(`      npm run setup`);
  console.log(`\n`);
  console.log(`   This will ensure your workspace is properly reset with all the updates.`);
  console.log(`   It is also recommended to clean all your demo apps.`);
  console.log(`\n`);
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
