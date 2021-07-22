import { Tree, readJson, removeProjectConfiguration } from '@nrwl/devkit';
import { stringUtils } from '@nrwl/workspace';
import { prerun, getNpmScope } from '../../utils';
import syncPackagesWithDemos from '../sync-packages-with-demos';
import { Schema } from './schema';

let name: string;
export default function (tree: Tree, schema: Schema) {
  name = stringUtils.dasherize(schema.name);

  prerun(tree);
  removePackage(tree);

  removeProjectConfiguration(tree, name);

  removeFromReadMe(tree);

  removeSharedDemoFiles(tree);

  syncPackagesWithDemos(
    tree,
    {
      packages: name,
    },
    '../sync-packages-with-demos/'
  );

  console.log(`"${getNpmScope()}/${name}" removed from 'packages' and removed from all demo apps.`);
}

function removePackage(tree: Tree) {
  console.log(`Removing plugin ${name}...`);

  tree.delete(`packages/${name}`);
}

function removeSharedDemoFiles(tree: Tree) {
  tree.delete(`tools/demo/${name}`);
}

function removeFromReadMe(tree: Tree) {
  const readmePath = 'README.md';
  let readmeContent = tree.read(readmePath).toString('utf-8');

  readmeContent = readmeContent.replace(`- ${getNpmScope()}/${name}`, '');

  // console.log(readmeContent);
  tree.write(readmePath, readmeContent);
}
