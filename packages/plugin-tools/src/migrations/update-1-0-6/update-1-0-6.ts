import { Tree, updateJson } from '@nx/devkit';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    json.devDependencies = json.devDependencies || {};
    json.devDependencies = {
      ...json.devDependencies,
      typescript: '~4.0.3',
    };

    return json;
  });
}
