import { addProjectConfiguration, generateFiles, joinPathFragments, readProjectConfiguration, Tree, updateProjectConfiguration } from '@nrwl/devkit';
import { stringUtils, addProjectToNxJsonInTree } from '@nrwl/workspace';
import { updateReadMe, prerun, getNpmScope } from '../../utils';
import syncPackagesWithDemos from '../sync-packages-with-demos';
import { Schema } from './schema';

let name: string;
let npmPackageName: string;
export default async function (tree: Tree, schema: Schema) {
  name = stringUtils.dasherize(schema.name);
  npmPackageName = schema.isScoped ? `${getNpmScope()}/${name}` : name;
  prerun(tree);
  addPackageFiles(tree);
  addProjectToNxJsonInTree(name, {});
  updateWorkspaceConfig(tree);
  updateWorkspaceScripts(tree);
  updateReadMe(tree);
  syncPackagesWithDemos(
    tree,
    {
      packages: name,
    },
    '../sync-packages-with-demos/',
    true
  );

  console.log(`"${npmPackageName}" created and added to all demo apps. Ready to develop!`);
}

function addPackageFiles(tree: Tree) {
  generateFiles(tree, joinPathFragments(__dirname, 'files'), `./packages/${name}`, { name, npmPackageName,  npmScope: getNpmScope(), stringUtils, tmpl: '', dot: '.' });
}

function updateWorkspaceConfig(tree: Tree) {
  addProjectConfiguration(tree, name, {
    root: `packages/${name}`,
    projectType: 'library',
    sourceRoot: `packages/${name}`,
    targets: {
      build: {
        executor: '@nrwl/node:package',
        options: {
          outputPath: `dist/packages/${name}`,
          tsConfig: `packages/${name}/tsconfig.json`,
          packageJson: `packages/${name}/package.json`,
          main: `packages/${name}/index.d.ts`,
          assets: [
            `packages/${name}/*.md`,
            `packages/${name}/index.d.ts`,
            'LICENSE',
            {
              glob: '**/*',
              input: `packages/${name}/platforms/`,
              output: './platforms/',
            },
          ],
        },
      },
      'build.all': {
        executor: '@nrwl/workspace:run-commands',
        options: {
          commands: [`nx run ${name}:build`, `node tools/scripts/build-finish.ts ${name}`],
          parallel: false,
        },
      },
      focus: {
        executor: '@nrwl/workspace:run-commands',
        options: {
          commands: [`nx g @nativescript/plugin-tools:focus-packages ${name}`],
          parallel: false,
        },
      },
    },
    tags: []
  });
  const allConfig = readProjectConfiguration(tree, 'all');
  if (allConfig) {
    let commands = [];
    if (allConfig.targets?.build?.options?.commands) {
      commands = allConfig.targets.build.options.commands;
      commands.push(`nx run ${name}:build.all`);
    }
    updateProjectConfiguration(tree, 'all', {
      ...allConfig,
      targets: {
        build: {
          executor: allConfig.targets.build.executor,
          outputs: ['dist/packages'],
          options: {
            commands,
            parallel: false
          },
        },
        focus: allConfig.targets.focus
      },
    });
  }
}

function updateWorkspaceScripts(tree: Tree) {
  const workspaceScriptPath = 'tools/workspace-scripts.js';
  let workspaceScripts = tree.read(workspaceScriptPath).toString('utf-8');

  // Add package as build option
  const buildSectionIndex = workspaceScripts.indexOf(`'build-all':`);
  const buildStart = workspaceScripts.substring(0, buildSectionIndex);
  const buildEnd = workspaceScripts.substring(buildSectionIndex, workspaceScripts.length);
  const newBuild = `// ${npmPackageName}
			'${name}': {
				build: {
					script: 'nx run ${name}:build.all',
					description: '${npmPackageName}: Build',
				},
			},
`;
  workspaceScripts = `${buildStart}${newBuild}			${buildEnd}`;

  // Add package as focus option
  const focusSectionIndex = workspaceScripts.indexOf(`reset:`);
  const focusStart = workspaceScripts.substring(0, focusSectionIndex);
  const focusEnd = workspaceScripts.substring(focusSectionIndex, workspaceScripts.length);
  const newFocus = `'${name}': {
				script: 'nx run ${name}:focus',
				description: 'Focus on ${npmPackageName}',
			},
`;
  workspaceScripts = `${focusStart}${newFocus}			${focusEnd}`;
  // console.log(workspaceScripts);
  tree.write(workspaceScriptPath, workspaceScripts);
  return tree;
}
