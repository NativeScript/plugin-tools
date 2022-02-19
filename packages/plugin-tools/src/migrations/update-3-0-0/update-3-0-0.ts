import { generateFiles, joinPathFragments, readJson, removeProjectConfiguration, Tree, updateJson } from '@nrwl/devkit';
import { convertToNxProjectGenerator } from '@nrwl/workspace';

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
  generateFiles(tree, joinPathFragments(__dirname, 'files', '.eslintrc.json'), '.eslintrc.json', {});

  // for all apps and packages add .eslintrc
  

// update all references to the all package (mostly from the helper script)
// for all packages that have angular implementations add a custom .eslintrc inside the angular/ folder that extends the package's eslint
// remove from the root tsconfig the paths: "@scope/*": "packages/*"
// add to the root tsconfig, for every package: "@scope/package": "packages/package/index.ts"
// add to the root tsconfig, for every package with angular: "@scope/package/angular": "packages/package/angular/index.ts"
// add cache and overall improvements to the workspace.json (outputs, dependencies and some other stuff) - TODO: find exactly what these are
// on apps' tsconfig.json, change paths to be { "~/": "app/*", ...all the things from the root tsconfig paths }
// Edit the generators to no longer create the "all" link and also add the correct eslint files

  // updateDemoAppPackages(tree);

  // Last Step, migrate plugin workspace to nx-project config style
  convertToNxProjectGenerator(tree, {
    all: true
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
