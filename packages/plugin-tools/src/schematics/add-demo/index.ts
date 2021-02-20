import { JsonArray } from '@angular-devkit/core';
import {
  chain,
  Rule,
  Tree,
  SchematicContext,
  apply,
  url,
  move,
  mergeWith,
  template,
} from '@angular-devkit/schematics';
import {
  stringUtils,
  addProjectToNxJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { noop } from 'rxjs';
import {
  updateWorkspaceJson,
  getJsonFromFile,
  updateReadMe,
  prerun,
  getNpmScope,
  updateRootDependencies,
} from '../../utils';
import syncPackagesWithDemos from '../sync-packages-with-demos';
import { Schema } from './schema';

let framework: string;
export default function (schema: Schema): Rule {
  framework = schema.framework;

  return chain([prerun(), getChains(schema)]);
}

function getChains(schema: Schema) {
  return (tree: Tree, context: SchematicContext) => {
    if (tree.exists(`apps/${getDemoAppName()}/package.json`)) {
      context.logger.info(
        `${
          framework === 'angular' ? 'An' : 'A'
        } "${framework}" demo already exists at "apps/${getDemoAppName()}"`
      );
      return noop();
    } else {
      const rootPackageUpdates: {
        scripts?: any;
        dependencies?: any;
        devDependencies?: any;
      } = {};

      switch (framework) {
        case 'react':
          rootPackageUpdates.devDependencies = {
            '@pmmmwh/react-refresh-webpack-plugin': '^0.4.0-beta.5',
            '@react-navigation/core': '^5.13.2',
            '@types/react': '16.9.34',
            '@unimodules/core': '^5.5.1',
            'babel-loader': '8.0.6',
            'expo-permissions': '^9.3.0',
            'patch-package': '^6.2.2',
            react: '^16.13.1',
            'react-nativescript': '^2.1.0',
            'react-nativescript-navigation': '^2.0.1',
            'react-refresh': '^0.8.3',
            'unimodules-file-system-interface': '^5.3.0',
            'unimodules-permissions-interface': '^5.3.0',
          };
          break;
        case 'vue':
          break;
        case 'svelte':
          break;
      }

      return chain([
        addDemoFiles(schema),
        addDemoFilesExtras(schema),
        addProjectToNxJsonInTree(getDemoAppName(), {}),
        updateRootDependencies(rootPackageUpdates),
        updateWorkspaceConfig(),
        updateWorkspaceScripts(),
        syncPackagesWithDemos({}, '../sync-packages-with-demos/'),
        (tree: Tree, context: SchematicContext) => {
          context.logger.info(
            `"apps/${getDemoAppName()}" created. Ready to demo!`
          );
        },
      ]);
    }
  };
}

function getDemoAppName() {
  return `demo${framework === 'vanilla' ? '' : '-' + framework}`;
}

function addDemoFiles(schema: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info(`Adding apps/${getDemoAppName()}...`);

    const templateSource = apply(url(`./files_${framework}`), [
      template({
        framework,
        npmScope: getNpmScope(),
        stringUtils,
        tmpl: '',
        dot: '.',
      }),
      move(`apps/${getDemoAppName()}`),
    ]);

    return chain([mergeWith(templateSource)])(tree, context);
  };
}

function addDemoFilesExtras(schema: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    switch (framework) {
      case 'react':
        const templateSource = apply(url(`./files_${framework}_patches`), [
          template({
            framework,
            npmScope: getNpmScope(),
            stringUtils,
            tmpl: '',
            dot: '.',
          }),
          move(`/patches`),
        ]);

        return chain([mergeWith(templateSource)])(tree, context);
      default:
        return noop();
    }
  };
}

function updateWorkspaceConfig() {
  return (tree: Tree, context: SchematicContext) => {
    return updateWorkspace((workspace) => {
      workspace.projects.add({
        name: getDemoAppName(),
        root: `apps/${getDemoAppName()}/`,
        sourceRoot: `apps/${getDemoAppName()}/src`,
        projectType: 'application',
        prefix: getDemoAppName(),
        generators: {},
        targets: {
          ios: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: ['ns debug ios --no-hmr --emulator --env.testing'],
              cwd: `apps/${getDemoAppName()}`,
              parallel: false,
            },
          },
          android: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: ['ns debug android --no-hmr --emulator --env.testing'],
              cwd: `apps/${getDemoAppName()}`,
              parallel: false,
            },
          },
          clean: {
            builder: '@nrwl/workspace:run-commands',
            options: {
              commands: ['ns clean', 'npm i'],
              cwd: `apps/${getDemoAppName()}`,
              parallel: false,
            },
          },
        },
      });
    });
  };
}

function updateWorkspaceScripts() {
  return (tree: Tree, context: SchematicContext) => {
    const workspaceScriptPath = 'tools/workspace-scripts.js';
    let workspaceScripts = tree.read(workspaceScriptPath).toString('utf-8');

    // Add package as build option
    const buildSectionIndex = workspaceScripts.indexOf(`'build-all':`);
    const buildStart = workspaceScripts.substring(0, buildSectionIndex);
    const buildEnd = workspaceScripts.substring(
      buildSectionIndex,
      workspaceScripts.length
    );
    const newBuild = `// ${getNpmScope()}/${name}
			'${name}': {
				build: {
					script: 'nx run ${name}:build.all',
					description: '${getNpmScope()}/${name}: Build',
				},
			},
`;
    workspaceScripts = `${buildStart}${newBuild}			${buildEnd}`;

    // Add package as focus option
    const focusSectionIndex = workspaceScripts.indexOf(`reset:`);
    const focusStart = workspaceScripts.substring(0, focusSectionIndex);
    const focusEnd = workspaceScripts.substring(
      focusSectionIndex,
      workspaceScripts.length
    );
    const newFocus = `'${name}': {
				script: 'nx run ${name}:focus',
				description: 'Focus on ${getNpmScope()}/${name}',
			},
`;
    workspaceScripts = `${focusStart}${newFocus}			${focusEnd}`;
    // context.logger.info(workspaceScripts);
    tree.overwrite(workspaceScriptPath, workspaceScripts);
    return tree;
  };
}
