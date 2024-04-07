import { generateFiles, joinPathFragments, readJson, Tree, updateJson } from '@nx/devkit';
import * as stringUtils from '@nx/devkit/src/utils/string-utils';
import { prerun, getNpmScope } from '../../utils';
import { Schema } from './schema';

let name: string;
let npmPackageName: string;
export default async function (tree: Tree, schema: Schema) {
  name = stringUtils.dasherize(schema.name.toLowerCase());

  prerun(tree);
  addAngularFiles(tree);
  updateJson(tree, 'tsconfig.base.json', (json) => {
    const packagePath = {};
    packagePath[`${npmPackageName}/angular`] = [`packages/${name}/angular/index.ts`];
    json.compilerOptions.paths = { ...json.compilerOptions.paths, ...packagePath };
    return json;
  });
  console.log(`Angular support added for "${npmPackageName}". Continue developing the Angular support in the packages/${name}/angular folder.`);
}

function addAngularFiles(tree: Tree) {
  console.log(`Adding Angular support to ${name}...`);

  const packageJson = readJson(tree, `packages/${name}/package.json`);
  npmPackageName = packageJson.name;

  generateFiles(tree, joinPathFragments(__dirname, 'files'), `./packages/${name}/angular`, { name, npmPackageName, npmScope: getNpmScope(), stringUtils, tmpl: '', dot: '.' });
}
