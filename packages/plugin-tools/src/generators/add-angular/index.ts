import { generateFiles, joinPathFragments, readJson, Tree } from '@nrwl/devkit';
import { stringUtils } from '@nrwl/workspace';
import { prerun, getNpmScope, getNxNpmScope } from '../../utils';
import { Schema } from './schema';

let name: string;
let npmPackageName: string;
export default async function (tree: Tree, schema: Schema) {
  name = stringUtils.dasherize(schema.name.toLowerCase());

  prerun(tree);
  addAngularFiles(tree);
  console.log(`Angular support added for "${npmPackageName}". Continue developing the Angular support in the packages/${name}/angular folder.`);
}

function addAngularFiles(tree: Tree) {
  console.log(`Adding Angular support to ${name}...`);

  const packageJson = readJson(tree, `packages/${name}/package.json`);
  npmPackageName = packageJson.name;

  generateFiles(tree, joinPathFragments(__dirname, 'files'), `./packages/${name}/angular`, { name, npmPackageName, npmScope: getNpmScope(), nxNpmScope: getNxNpmScope(), stringUtils, tmpl: '', dot: '.' });
}
