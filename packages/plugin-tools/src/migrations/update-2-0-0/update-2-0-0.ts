import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  url,
  template,
  Tree,
} from '@angular-devkit/schematics';
import { createOrUpdate, updateJsonInTree, output } from '@nrwl/workspace';
import { join } from 'path';
import * as fs from 'fs';
import { updateJsonFile, getJsonFromFile } from '@nativescript/plugin-tools';

export default function (): Rule {
  return chain([
    (tree: Tree, context: SchematicContext) => {
      return updateJsonInTree('package.json', (json) => {
        json.scripts = json.scripts || {};
        const postInstallParts = [
          'husky install',
          'npx ts-patch install',
          'ngcc --properties es2015 browser module main',
        ];
        if (json.scripts.postinstall) {
          // include parts that are not there yet
          const origParts = json.scripts.postinstall
            .split('&&')
            .map((p) => p.trim());
          for (const p of origParts) {
            if (!postInstallParts.includes(p) && p.indexOf('husky/lib') === -1) {
              postInstallParts.push(p);
            }
          }
        }
        json.scripts.postinstall = postInstallParts.join(' && ');
        json.scripts['setup'] =
          'npx rimraf node_modules package-lock.json dist tmp yarn.lock && yarn config set ignore-engines true && ns package-manager set npm && yarn';
        json.scripts[
          'sync-packages-with-demos'
        ] = `nx g @nativescript/plugin-tools:sync-packages-with-demos`;
        json.devDependencies = json.devDependencies || {};
        json.devDependencies = {
          ...json.devDependencies,
          '@angular/animations': '^12.0.0',
          '@angular/common': '^12.0.0',
          '@angular/compiler': '^12.0.0',
          '@angular/compiler-cli': '^12.0.0',
          '@angular/core': '^12.0.0',
          '@angular/forms': '^12.0.0',
          '@angular/platform-browser': '^12.0.0',
          '@angular/platform-browser-dynamic': '^12.0.0',
          '@angular/router': '^12.0.0',
          '@nativescript/angular': '^12.0.0',
          '@nativescript/core': '^8.0.0',
          '@nativescript/webpack': 'beta',
          '@nativescript/types': '^8.0.0',
          '@ngtools/webpack': '^12.0.0',
          husky: '^5.1.3',
          'nativescript-vue': '~2.9.0',
          'nativescript-vue-template-compiler': '~2.9.0',
          'ng-packagr': '^12.0.0',
          'zone.js': '~0.11.1',
          typescript: '~4.2.0',
        };

        delete json['husky'];

        json['lint-staged'] = {
          '**/*.{js,ts,scss,json,html}': ['npx prettier --write'],
        };

        return json;
      });
    },
    addHuskyPrecommit(),
    updateDemoFiles(),
    updateDemoFiles('angular'),
    updateDemoAppPackages(),
    updatePackages(),
    updateTSConfig(),
    updateWorkspace(),
    (tree: Tree, context: SchematicContext) => {
      console.log(
        `\n   NOTE: Your plugin workspace is now migrated. Run this to finish the dependency cleanup:`
      );
      console.log(`\n`);
      console.log(`      npm run setup`);
      console.log(`\n`);
      console.log(
        `   This will ensure your workspace is properly reset with all the updates.\n\n`
      );
      console.log(`   It is also recommended to clean all your demo apps.`);
      console.log(`\n`);
    },
  ]);
}

function updateDemoFiles(type?: 'angular'): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const demoPath = `apps/demo${type ? '-' + type : ''}`;
    context.logger.info(`Updating webpack config for: ${demoPath}`);

    const cwd = process.cwd();
    const webpackConfigPath = join(
      cwd,
      `node_modules/@nativescript/plugin-tools/src/migrations/update-2-0-0/_files_demo${
        type ? '_' + type : ''
      }/webpack.config.js`
    );
    // console.log('webpackConfigPath:', webpackConfigPath);
    const webpackConfig = fs.readFileSync(webpackConfigPath, {
      encoding: 'utf-8',
    });
    createOrUpdate(tree, `${demoPath}/webpack.config.js`, webpackConfig);

    // remove ~ from css imports for webpack5
    const demoAppCssPath = `${demoPath}/src/app.css`;
    const appCssPath = join(cwd, demoAppCssPath);
    // console.log('webpackConfigPath:', webpackConfigPath);
    const appCss = fs.readFileSync(appCssPath, {
      encoding: 'utf-8',
    });
    const scssImports = `@import 'nativescript-theme-core/scss/light';
@import 'nativescript-theme-core/scss/index';`;
    createOrUpdate(
      tree,
      `${demoPath}/src/app.scss`,
      appCss.replace(
        `@import '~nativescript-theme-core/css/core.light.css';`,
        scssImports
      )
    );
    tree.delete(demoAppCssPath);

    switch (type) {
      case 'angular':
        // add polyfills
        const polyfillsPath = join(
          cwd,
          `node_modules/@nativescript/plugin-tools/src/migrations/update-2-0-0/_files_demo_angular/polyfills.ts__tmpl__`
        );
        // console.log('polyfillsPath:', polyfillsPath);
        const polyfills = fs.readFileSync(polyfillsPath, {
          encoding: 'utf-8',
        });
        createOrUpdate(tree, `${demoPath}/src/polyfills.ts`, polyfills);

        // adjust main
        const ngMain = `import { runNativeScriptAngularApp, platformNativeScript } from '@nativescript/angular';
import { AppModule } from './app.module';

runNativeScriptAngularApp({
  appModuleBootstrap: () => platformNativeScript().bootstrapModule(AppModule),
});
        `;
        createOrUpdate(tree, `${demoPath}/src/main.ts`, ngMain);

        // update tsconfig
        const tsconfigPath = `${demoPath}/tsconfig.json`;
        const tsconfigJson = getJsonFromFile(tree, tsconfigPath);

        if (tsconfigJson && tsconfigJson.files) {
          if (!tsconfigJson.files.includes('./src/polyfills.ts')) {
            tsconfigJson.files.push('./src/polyfills.ts');
          }

          tree = updateJsonFile(tree, tsconfigPath, tsconfigJson);
        }

        break;
    }

    return tree;
  };
}

function updateDemoAppPackages(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const appsDir = tree.getDir('apps');
    const appFolders = appsDir.subdirs;
    for (const dir of appFolders) {
      // console.log(dir);
      if (dir.indexOf('demo') > -1) {
        const appDir = `${appsDir.path}/${dir}`;
        // console.log('appDir:', appDir);

        // update demo app deps
        const packagePath = `${appDir}/package.json`;
        const packageJson = getJsonFromFile(tree, packagePath);

        if (packageJson) {
          if (appDir.indexOf('angular') > -1) {
            packageJson.main = `./src/main.ts`;
            for (const key in packageJson.dependencies) {
              if (key.indexOf('@angular/') > -1) {
                delete packageJson.dependencies[key];
              }
            }
            delete packageJson.dependencies['@nativescript/angular'];
            delete packageJson.dependencies['reflect-metadata'];
            delete packageJson.dependencies['rxjs'];
            delete packageJson.dependencies['zone.js'];
          } else {
            packageJson.main = `./src/app.ts`;
          }
          delete packageJson.dependencies['nativescript-theme-core'];
          packageJson.devDependencies = {
            '@nativescript/android': '8.0.0',
            '@nativescript/ios': '8.0.0',
          };

          // console.log('path:',path);
          // console.log('packageJson overwrite:', JSON.stringify(packageJson));
          tree = updateJsonFile(tree, packagePath, packageJson);
        }
      }
    }
    return tree;
  };
}

function updatePackages(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const packagesDir = tree.getDir('packages');
    const packageFolders = packagesDir.subdirs;
    for (const dir of packageFolders) {
      // console.log(dir);
        const packageDir = `${packagesDir.path}/${dir}`;
        console.log('packageDir:', packageDir);
        const ngPackagePath = `${packageDir}/angular/package.json`;
        console.log('ngPackagePath:', ngPackagePath);
        if (tree.exists(ngPackagePath)) {
          const ngPackageJson = getJsonFromFile(tree, ngPackagePath);
          if (
            ngPackageJson &&
            ngPackageJson.ngPackage.whitelistedNonPeerDependencies
          ) {
            const peerValue =
              ngPackageJson.ngPackage.whitelistedNonPeerDependencies;
            delete ngPackageJson.ngPackage.whitelistedNonPeerDependencies;
            ngPackageJson.ngPackage.allowedNonPeerDependencies = peerValue;
            tree = updateJsonFile(tree, ngPackagePath, ngPackageJson);
          }

          const tsconfgNg = `{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "rootDir": "."
  }
}
          `;

          createOrUpdate(tree, `${packageDir}/angular/tsconfig.json`, tsconfgNg);
        }
      
    }
    return tree;
  };
}

function updateTSConfig(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const tsconfigJson = getJsonFromFile(tree, 'tsconfig.base.json');

    if (
      tsconfigJson &&
      tsconfigJson.compilerOptions &&
      tsconfigJson.compilerOptions.plugins
    ) {
      tsconfigJson.compilerOptions.plugins = [
        {
          transform: '@nativescript/webpack/dist/transformers/NativeClass',
          type: 'raw',
        },
      ];

      tree = updateJsonFile(tree, 'tsconfig.base.json', tsconfigJson);
    }

    return tree;
  };
}

function updateWorkspace(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    return updateJsonInTree('workspace.json', (json) => {
      json.projects = json.projects || {};
      for (const project in json.projects) {
        if (json.projects[project].projectType === 'application') {
          // update to use builder
          json.projects[project].architect = {
            build: {
              builder: '@nativescript/nx:build',
              options: {
                noHmr: true,
                production: true,
                uglify: true,
                release: true,
                forDevice: true,
              },
            },
            ios: {
              builder: '@nativescript/nx:build',
              options: {
                platform: 'ios',
              },
            },
            android: {
              builder: '@nativescript/nx:build',
              options: {
                platform: 'android',
              },
            },
            clean: {
              builder: '@nativescript/nx:build',
              options: {
                clean: true,
              },
            },
          };
        } else if (json.projects[project].projectType === 'library') {
          if (
            json.projects[project].architect &&
            json.projects[project].architect.build &&
            json.projects[project].architect.build.options &&
            json.projects[project].architect.build.options.main
          ) {
            const mainIndex =
              json.projects[project].architect.build.options.main;
            if (mainIndex.indexOf('index.d.ts') === -1) {
              // update to use index.d.ts since plugins don't use an explicit index.ts but rather .ios/.android indices
              json.projects[project].architect.build.options.main =
                mainIndex.replace('index.ts', 'index.d.ts');
            }
          }
        }
      }

      return json;
    });
  };
}
function addHuskyPrecommit(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info(`Updating husky precommit...`);

    const templateSource = apply(url('./_files_husky'), [
      template({
        tmpl: '',
        dot: '.',
      }),
      move(``),
    ]);

    return chain([mergeWith(templateSource)])(tree, context);
  };
}
