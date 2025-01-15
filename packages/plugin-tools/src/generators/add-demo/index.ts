import { addProjectConfiguration, generateFiles, joinPathFragments, readProjectConfiguration, Tree, updateJson, updateProjectConfiguration } from '@nx/devkit';
import * as stringUtils from '@nx/devkit/src/utils/string-utils';
import { updateReadMe, prerun, getNpmScope, getSrcFolderForType, SupportedDemoType, getAllPackages } from '../../utils';
import syncPackagesWithDemos from '../sync-packages-with-demos';
import { Schema } from './schema';

export default async function (tree: Tree, schema: Schema) {
  prerun(tree);
  const demoName = `demo-${schema.type}`;
  const appPath = `apps/${demoName}/package.json`;
  if (tree.exists(appPath)) {
    throw new Error(`Your workspace already contains a "demo-${schema.type}" app. Plugin workspaces should contain only 1 demo app for any particular flavor integration for simplicity and ease of maintenance.`);
  } else {
    prerun(tree);
    addAppFiles(tree, schema.type);
    updateWorkspaceConfig(tree, demoName, schema.type);
    updateWorkspaceScripts(tree, schema.type);

    if (schema.type === 'react') {
      // handle patches
      handlePatches(tree);
    }

    updateRootPackageDeps(tree, schema.type);
    updateRootTSConfig(tree, schema.type);

    syncPackagesWithDemos(tree, null, '../sync-packages-with-demos/');

    console.log('\n');
    console.log(`"apps/${demoName}" created!`);
    console.log('\n');
    console.log('IMPORTANT: Before trying your new demo, run this first to ensure dependencies are installed properly:');
    console.log('    npm run setup');
    console.log('\n');
  }
}

function addAppFiles(tree: Tree, type: string) {
  generateFiles(tree, joinPathFragments(__dirname, `files_${type}`), `./apps/demo-${type}`, { npmScope: getNpmScope(), stringUtils, tmpl: '', dot: '.' });
}

function handlePatches(tree: Tree) {
  generateFiles(tree, joinPathFragments(__dirname, 'files_react_patches'), `./patches`, { npmScope: getNpmScope(), stringUtils, tmpl: '', dot: '.' });
}

function updateRootPackageDeps(tree: Tree, type: SupportedDemoType) {
  updateJson(tree, 'package.json', (json) => {
    let devDependencies = {};
    switch (type) {
      case 'react':
        json.scripts = json.scripts || {};
        if (json.scripts.postinstall && json.scripts.postinstall.indexOf('patch-package') === -1) {
          json.scripts.postinstall = json.scripts.postinstall + ' && patch-package';
        }
        devDependencies = {
          '@pmmmwh/react-refresh-webpack-plugin': '~0.4.0-beta.5',
          '@react-navigation/core': '^5.15.3',
          '@types/react': '16.9.34',
          'patch-package': '~6.4.0',
          react: '~16.13.1',
          'react-nativescript': '^3.0.0-beta.1',
          'react-nativescript-navigation': '3.0.0-beta.2',
          'react-refresh': '~0.8.3',
        };
        break;
      case 'svelte':
        devDependencies = {
          svelte: '~3.35.0',
          'svelte-loader-hot': '~0.3.1',
          'svelte-native-preprocessor': '^1.0.0',
          'svelte-native': '~1.0.0',
          'svelte-preprocess': '^4.7.0',
        };
        break;
      case 'vue':
        devDependencies = {
          'nativescript-vue-template-compiler': '^2.9.3',
          'nativescript-vue': '^2.9.3',
          vue: '~2.6.12',
        };
        break;
    }
    json.devDependencies = {
      ...json.devDependencies,
      ...devDependencies,
    };
    return json;
  });
}

function updateRootTSConfig(tree: Tree, type: SupportedDemoType) {
  switch (type) {
    case 'react':
      updateJson(tree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.jsx = 'react';
        return json;
      });

      break;
  }
}

function updateWorkspaceConfig(tree: Tree, name: string, type: SupportedDemoType) {
  const srcFolder = getSrcFolderForType(type);

  addProjectConfiguration(tree, name, {
    root: `apps/${name}/`,
    projectType: 'application',
    sourceRoot: `apps/${name}/${srcFolder}`,
    targets: {
      build: {
        executor: '@nativescript/nx:build',
        options: {
          noHmr: true,
          production: true,
          uglify: true,
          release: true,
          forDevice: true,
        },
        dependsOn: [
          {
            target: 'build.all',
            projects: 'dependencies',
          },
        ],
      },
      ios: {
        executor: '@nativescript/nx:build',
        options: {
          platform: 'ios',
        },
        dependsOn: [
          {
            target: 'build.all',
            projects: 'dependencies',
          },
        ],
      },
      android: {
        executor: '@nativescript/nx:build',
        options: {
          platform: 'android',
        },
        dependsOn: [
          {
            target: 'build.all',
            projects: 'dependencies',
          },
        ],
      },
      clean: {
        executor: '@nativescript/nx:build',
        options: {
          clean: true,
        },
      },
      lint: {
        executor: '@nx/eslint:eslint',
        options: {
          lintFilePatterns: [`apps/${name}/**/*.ts`],
        },
      },
    },
    tags: [],
  });
}

function updateWorkspaceScripts(tree: Tree, type: string) {
  const workspaceScriptPath = 'tools/workspace-scripts.js';
  let workspaceScripts = tree.read(workspaceScriptPath).toString('utf-8');

  // Add package as build option
  const appsSectionIndex = workspaceScripts.indexOf(`apps:`);
  const starting = workspaceScripts.substring(0, appsSectionIndex);
  const appsEndIndex = workspaceScripts.indexOf(`'⚙️':`);
  const ending = workspaceScripts.substring(appsEndIndex, workspaceScripts.length);

  const demoReact = `'...React...': {
    script: 'npx cowsay "You like your TS with an X..."',
    description: ' 🔻 React',
  },
  'demo-react': {
    clean: {
      script: 'nx run demo-react:clean',
      description: '⚆  Clean  🧹',
    },
    ios: {
      script: 'nx run demo-react:ios',
      description: '⚆  Run iOS  ',
    },
    android: {
      script: 'nx run demo-react:android',
      description: '⚆  Run Android  🤖',
    },
  },`;
  const demoSvelte = `'...Svelte...': {
    script: 'npx cowsay "You are a minimalist!"',
    description: ' 🔻 Svelte',
  },
  'demo-svelte': {
    clean: {
      script: 'nx run demo-svelte:clean',
      description: '⚆  Clean  🧹',
    },
    ios: {
      script: 'nx run demo-svelte:ios',
      description: '⚆  Run iOS  ',
    },
    android: {
      script: 'nx run demo-svelte:android',
      description: '⚆  Run Android  🤖',
    },
  },`;
  const demoVue = `'...Vue...': {
    script: 'npx cowsay "You like the vue here..."',
    description: ' 🔻 Vue',
  },
  'demo-vue': {
    clean: {
      script: 'nx run demo-vue:clean',
      description: '⚆  Clean  🧹',
    },
    ios: {
      script: 'nx run demo-vue:ios',
      description: '⚆  Run iOS  ',
    },
    android: {
      script: 'nx run demo-vue:android',
      description: '⚆  Run Android  🤖',
    },
  },`;

  const newDemoApps = `apps: {
        '...Vanilla...': {
          script: 'npx cowsay "Nothing wrong with vanilla 🍦"',
          description: ' 🔻 Vanilla',
        },
        demo: {
          clean: {
            script: 'nx run demo:clean',
            description: '⚆  Clean  🧹',
          },
          ios: {
            script: 'nx run demo:ios',
            description: '⚆  Run iOS  ',
          },
          android: {
            script: 'nx run demo:android',
            description: '⚆  Run Android  🤖',
          },
        },
        '...Angular...': {
          script: 'npx cowsay "Test all the Angles!"',
          description: ' 🔻 Angular',
        },
        'demo-angular': {
          clean: {
            script: 'nx run demo-angular:clean',
            description: '⚆  Clean  🧹',
          },
          ios: {
            script: 'nx run demo-angular:ios',
            description: '⚆  Run iOS  ',
          },
          android: {
            script: 'nx run demo-angular:android',
            description: '⚆  Run Android  🤖',
          },
        },
        ${type === 'react' ? demoReact : ''}
        ${type === 'svelte' ? demoSvelte : ''}
        ${type === 'vue' ? demoVue : ''}
  },
`;
  // console.log('starting ---', starting);
  // console.log('newDemoApps ---', newDemoApps);
  // console.log('ending ---', ending);
  workspaceScripts = `${starting}${newDemoApps}
    ${ending}`;

  // console.log(workspaceScripts);
  tree.write(workspaceScriptPath, workspaceScripts);
  return tree;
}
