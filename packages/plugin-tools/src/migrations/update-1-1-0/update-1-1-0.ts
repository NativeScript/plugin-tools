import { readJson, Tree, updateJson } from '@nx/devkit';
import { join } from 'path';
import * as fs from 'fs';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    json.scripts = json.scripts || {};
    const huskyPostInstall = `node ./node_modules/husky/lib/installer/bin install`;
    if (json.scripts.postinstall) {
      if (json.scripts.postinstall.indexOf('husky/lib') === -1) {
        // has other postinstall, also add husky
        json.scripts.postinstall = huskyPostInstall + ' && ' + json.scripts.postinstall;
      }
    } else {
      json.scripts.postinstall = huskyPostInstall;
    }
    json.scripts['sync-packages-with-demos'] = `nx g @nativescript/plugin-tools:sync-packages-with-demos`;
    json.devDependencies = json.devDependencies || {};
    json.devDependencies = {
      ...json.devDependencies,
      '@angular/animations': '~11.2.0',
      '@angular/common': '~11.2.0',
      '@angular/compiler': '~11.2.0',
      '@angular/compiler-cli': '~11.2.0',
      '@angular/core': '~11.2.0',
      '@angular/forms': '~11.2.0',
      '@angular/platform-browser': '~11.2.0',
      '@angular/platform-browser-dynamic': '~11.2.0',
      '@angular/router': '~11.2.0',
      '@nativescript/angular': '~11.0.0',
      '@nativescript/core': '~7.2.0',
      '@nativescript/webpack': '~4.1.0',
      '@nativescript/types': '~7.2.0',
      '@ngtools/webpack': '~11.2.0',
      husky: '^4.3.0',
      'ng-packagr': '~11.2.0',
      'zone.js': '~0.11.1',
      typescript: '~4.0.3',
    };

    return json;
  });

  updateDemoWebpackFiles(tree);
  updateDemoWebpackFiles(tree, 'angular');
  updateDemoAppPackages(tree);
  console.log(`\n   NOTE: Your plugin workspace is now updated. ~ Important ~ Run this to finish:`);
  console.log(`\n`);
  console.log(`   npm run setup`);
  console.log(`\n`);
  console.log(`   This will ensure your workspace is properly reset to continue developing in confidence with all the updates.\n\n`);
}

function updateDemoWebpackFiles(tree: Tree, type?: 'angular') {
  const demoPath = `apps/demo${type ? '-' + type : ''}`;
  console.log(`Updating webpack config for: ${demoPath}`);

  const cwd = process.cwd();
  const webpackConfigPath = join(cwd, `node_modules/@nativescript/plugin-tools/migrations/update-1-1-0/_files_demo${type ? '_' + type : ''}/webpack.config.js`);
  // console.log('webpackConfigPath:', webpackConfigPath);
  const webpackConfig = fs.readFileSync(webpackConfigPath, { encoding: 'utf-8' });
  tree.write(`${demoPath}/webpack.config.js`, webpackConfig);
}

function updateDemoAppPackages(tree: Tree) {
  const appFolders = tree.children('apps');
  for (const dir of appFolders) {
    // console.log(dir);
    if (dir.indexOf('demo') > -1) {
      // update demo app deps
      const packagePath = `apps/${dir}/package.json`;
      // console.log('packagePath:', packagePath);

      // console.log('path:',path);
      // console.log('packageJson overwrite:', JSON.stringify(packageJson));
      updateJson(tree, packagePath, (packageJson) => {
        packageJson.devDependencies = packageJson.devDependencies || {};
        packageJson.devDependencies = {
          ...packageJson.devDependencies,
          '@nativescript/ios': '7.2.0',
          '@nativescript/webpack': '~4.1.0',
        };
        return packageJson;
      });
    }
  }
}
