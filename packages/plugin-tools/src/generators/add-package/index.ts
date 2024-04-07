import { addProjectConfiguration, generateFiles, getProjects, joinPathFragments, readJson, readProjectConfiguration, Tree, updateJson, updateProjectConfiguration } from '@nx/devkit';
import * as stringUtils from '@nx/devkit/src/utils/string-utils';
import { updateReadMe, prerun, getNpmScope } from '../../utils';
import syncPackagesWithDemos from '../sync-packages-with-demos';
import { Schema } from './schema';

let name: string;
let npmPackageName: string;
export default async function (tree: Tree, schema: Schema) {
  name = stringUtils.dasherize(schema.name);
  prerun(tree);
  npmPackageName = schema.isScoped ? `${getNpmScope()}/${name}` : name;
  addPackageFiles(tree);
  updateWorkspaceConfig(tree);
  updateWorkspaceScripts(tree);
  updateReadMe(tree);
  updateJson(tree, 'tsconfig.base.json', (json) => {
    const packagePath = {};
    packagePath[npmPackageName] = [`packages/${name}/index.d.ts`];
    json.compilerOptions.paths = { ...json.compilerOptions.paths, ...packagePath };
    return json;
  });
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
  // set default package values
  let repo = `https://github.com/NativeScript/plugins`;
  let gitAuthorName = `NativeScript`;
  let gitAuthorEmail = `oss@nativescript.org`;
  // check for custom package settings
  const toolsPackageSettingsPath = 'tools/package-settings.json';
  if (tree.exists(toolsPackageSettingsPath)) {
    const packageSettings = readJson(tree, toolsPackageSettingsPath);
    if (packageSettings) {
      if (packageSettings.repository && packageSettings.repository.url) {
        repo = packageSettings.repository.url.replace('.git', '');
      }
      if (packageSettings.author && packageSettings.author.name) {
        gitAuthorName = packageSettings.author.name;
      }
      if (packageSettings.author && packageSettings.author.email) {
        gitAuthorEmail = packageSettings.author.email;
      }
    }
  }
  generateFiles(tree, joinPathFragments(__dirname, 'files'), `./packages/${name}`, {
    name,
    npmPackageName,
    npmScope: getNpmScope(),
    repo,
    gitAuthorName,
    gitAuthorEmail,
    stringUtils,
    tmpl: '',
    dot: '.',
  });
}

function updateWorkspaceConfig(tree: Tree) {
  addProjectConfiguration(tree, name, {
    root: `packages/${name}`,
    projectType: 'library',
    sourceRoot: `packages/${name}`,
    targets: {
      build: {
        executor: '@nx/js:tsc',
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
          dependsOn: [
            {
              target: 'build.all',
              projects: 'dependencies',
            },
          ],
        },
      },
      'build.all': {
        executor: 'nx:run-commands',
        options: {
          commands: [`node tools/scripts/build-finish.ts ${name}`],
          parallel: false,
        },
        outputs: [`{workspaceRoot}/dist/packages/${name}`],
        dependsOn: [
          {
            target: 'build.all',
            projects: 'dependencies',
          },
          {
            target: 'build',
            projects: 'self',
          },
        ],
      },
      focus: {
        executor: 'nx:run-commands',
        options: {
          commands: [`nx g @nativescript/plugin-tools:focus-packages ${name}`],
          parallel: false,
        },
      },
      lint: {
        executor: '@nx/eslint:eslint',
        options: {
          lintFilePatterns: [`packages/${name}/**/*.ts`],
        },
      },
    },
    tags: [],
  });
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
