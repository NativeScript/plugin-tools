import { formatFiles, Tree, updateJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  updateDependencies(tree);
  cleanupWorkspaceScrips(tree);
  // TODO: Edit the generators to use the new tsconfig
  doNxMigrations(tree);

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
      json.devDependencies['@angular-devkit/build-angular'] = '^14.0.0';
      for (const key in json.devDependencies) {
        if (key.indexOf('@angular') > -1) {
          json.devDependencies[key] = '^14.0.0';
        }
      }
    }
    json.devDependencies['@nativescript/angular'] = '^14.0.0';
    json.devDependencies['@nativescript/core'] = '~8.2.0';
    json.devDependencies['@nativescript/types'] = '~8.2.0';
    json.devDependencies['@ngtools/webpack'] = '^14.0.0';
    json.devDependencies['husky'] = '^8.0.0';
    json.devDependencies['nativescript-permissions'] = '1.3.11';
    json.devDependencies['ng-packagr'] = '^14.0.0';
    json.devDependencies['rxjs'] = '~7.5.0';

    json.devDependencies['@nativescript/webpack'] = '~5.0.5';
    json.devDependencies['typescript'] = '~4.7.3';
    return json;
  });
}

function cleanupWorkspaceScrips(tree: Tree) {
  let workspaceScripts = tree.read('tools/workspace-scripts.js', 'utf-8');
  workspaceScripts = workspaceScripts.replace(`const npsUtils = require('nps-utils');`, '');
  tree.write('tools/workspace-scripts.js', workspaceScripts);
}

function doNxMigrations(tree: Tree) {
  updateJson(tree, 'nx.json', (json) => {
    json.tasksRunnerOptions = {
      default: {
        runner: 'nx/tasks-runners/default',
        options: {
          cacheableOperations: ['build', 'build.all', 'lint', 'test', 'e2e'],
          runtimeCacheInputs: ['node -v'],
          parallel: 1,
          useDaemonProcess: false
        },
      },
    };
    return json;
  });
}
