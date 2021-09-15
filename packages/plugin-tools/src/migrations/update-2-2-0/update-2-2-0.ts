import { readJson, Tree, updateJson } from '@nrwl/devkit';

export default async function (tree: Tree) {

  updateJson(tree, 'package.json', (json) => {
    json.devDependencies['@nativescript/webpack'] = '~5.0.0';
    json.devDependencies['typescript'] = '~4.3.5';
    return json;
  });

  updateDemoAppPackages(tree);

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
