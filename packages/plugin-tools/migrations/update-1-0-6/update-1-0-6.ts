import { chain, Rule, SchematicContext, Tree } from "@angular-devkit/schematics";
import { updateJsonInTree } from "@nrwl/workspace";

export default function (): Rule {
  return chain([
    (tree: Tree, context: SchematicContext) => {
      return updateJsonInTree('package.json', (json) => {
        json.devDependencies = json.devDependencies || {};
        json.devDependencies = {
          ...json.devDependencies,
          'typescript': '~4.0.3'
        };
    
        return json;
      })
    },
  ]);
}