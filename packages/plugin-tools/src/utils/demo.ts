/**
 * Demo utilities
 */
import { Tree, serializeJson } from '@nx/devkit';
import * as stringUtils from '@nx/devkit/src/utils/string-utils';
import { checkPackages, getJsonFromFile, getPackageNamesToUpdate, getAllPackages, getNpmScope, getNpmPackageNames } from './workspace';
const xml2js = require('xml2js');

export type SupportedDemoType = 'xml' | 'angular' | 'vue' | 'svelte' | 'react';
export const SupportedDemoTypes: Array<SupportedDemoType> = ['xml', 'angular', 'react', 'svelte', 'vue'];
let demoTypes: Array<SupportedDemoType> = SupportedDemoTypes;

export function setDemoTypes(types: Array<SupportedDemoType>) {
  demoTypes = types;
}

export function getDemoTypes(): Array<SupportedDemoType> {
  return demoTypes;
}

export function updateDemoSharedIndex(tree: Tree, allPackages: Array<string>, packages?: Array<string>, addingNew?: boolean) {
  if (addingNew) {
    // just add to all packages
    for (const p of packages) {
      if (!allPackages.includes(p)) {
        allPackages.push(p);
      }
    }
    packages = allPackages;
  } else {
    // isolate to packages or fallback to all
    packages = packages && packages.length ? packages : allPackages;
  }
  const demoSharedPath = `tools/demo/index.ts`;
  const demoSharedExport = (name: string) => {
    return `export * from './${name}';\n`;
  };
  const demoSharedIndex = `export * from './utils';\n${packages.sort().map(demoSharedExport).join('')}`;
  tree.write(demoSharedPath, demoSharedIndex);
}

export function addDependencyToDemoApp(tree: Tree, type: SupportedDemoType, demoAppRoot: string) {
  checkPackages(tree);
  // update app dependencies for plugin development
  updateDemoDependencies(tree, type, demoAppRoot);
}

export function updateDemoDependencies(tree: Tree, type: SupportedDemoType, demoAppRoot: string, allPackages?: Array<string>, focus?: boolean) {
  const packagePath = `${demoAppRoot}/package.json`;
  const packageData = getJsonFromFile(tree, packagePath);

  // update tsconfig
  const tsconfigPath = `${demoAppRoot}/tsconfig.json`;
  const tsconfig = getJsonFromFile(tree, tsconfigPath);

  const npmPackageNames = getNpmPackageNames();
  if (packageData) {
    packageData.dependencies = packageData.dependencies || {};
    const packageNamesToUpdate = getPackageNamesToUpdate();
    if (!packageNamesToUpdate || packageNamesToUpdate.length === 0) {
      // reset to all
      if (allPackages) {
        for (const name of allPackages) {
          const packageName = npmPackageNames[name];
          packageData.dependencies[packageName] = getPathToPackageForDemo(type, name);
          if (tsconfig?.compilerOptions?.paths && !tsconfig.compilerOptions.paths[packageName]) {
            tsconfig.compilerOptions.paths[packageName] = [`../../packages/${name}/index.d.ts`];
          }
        }
      }
    } else {
      for (const name of packageNamesToUpdate) {
        const packageName = npmPackageNames[name];
        packageData.dependencies[packageName] = getPathToPackageForDemo(type, name);
        if (tsconfig?.compilerOptions?.paths && !tsconfig.compilerOptions.paths[packageName]) {
          tsconfig.compilerOptions.paths[packageName] = [`../../packages/${name}/index.d.ts`];
        }
      }
      if (focus && allPackages) {
        // when focusing packages, remove others not being focused on
        for (const name of allPackages) {
          if (!packageNamesToUpdate.includes(name)) {
            delete packageData.dependencies[npmPackageNames[name]];
          }
        }
      }
    }

    tree.write(packagePath, serializeJson(packageData));
    if (tsconfig) {
      tree.write(tsconfigPath, serializeJson(tsconfig));
    }
  }
}

// Angular uses dist output to ensure properly built angular packages
// may can switch to all same once confirmed ngcc is absolutely no longer needed
export function getPathToPackageForDemo(type: SupportedDemoType, name: string) {
  return `file:../../${type === 'angular' ? 'dist/' : ''}packages/${name}`;
}

export function getDemoAppRoot(type: SupportedDemoType) {
  return `apps/demo${type !== 'xml' ? '-' + type : ''}`;
}

export function getPluginDemoPath(type: SupportedDemoType) {
  return `${getSrcFolderForType(type)}/plugin-demos`;
}

export function getSrcFolderForType(type: SupportedDemoType) {
  switch (type) {
    case 'svelte':
    case 'vue':
      return 'app';
    default:
      return 'src';
  }
}

export function getDemoTypeFromName(name: string): SupportedDemoType {
  const parts = name.split('-');
  if (parts.length > 1) {
    return <SupportedDemoType>parts[1];
  } else {
    // no suffix defaults to vanilla xml
    return 'xml';
  }
}

export function getDemoFlavorExt(type: SupportedDemoType) {
  let viewExt = 'xml';
  let viewClassExt = 'ts';
  let viewModuleExt;
  // adjust folder location and viewExt dependent on demo type if needed
  switch (type) {
    case 'angular':
      viewExt = 'component.html';
      viewClassExt = 'component.ts';
      viewModuleExt = 'module.ts';
      break;
    case 'react':
      viewExt = 'tsx';
      viewClassExt = null;
      break;
    case 'svelte':
      viewExt = 'svelte';
      viewClassExt = null;
      break;
    case 'vue':
      viewExt = 'vue';
      viewClassExt = null;
      break;
  }
  return {
    viewExt,
    viewClassExt,
    viewModuleExt,
  };
}

export function getDemoIndexButtonForType(
  type: SupportedDemoType,
  packageName: string,
): {
  buttonStart: string;
  buttonTap: string;
  buttonClass: string;
  buttonEnd: string;
  buttonMarkup: string;
} {
  let buttonClass = `class="btn btn-primary rounded view-demo"`;
  let buttonEnd = `/>`;
  let buttonStart: string;
  let buttonTap: string;
  switch (type) {
    case 'xml':
      buttonStart = `<Button text="${packageName}"`;
      buttonTap = `tap="{{ viewDemo }}"`;
      return {
        buttonStart,
        buttonTap,
        buttonClass,
        buttonEnd,
        buttonMarkup: `${buttonStart} ${buttonTap} ${buttonClass}${buttonEnd}`,
      };
    // case 'angular':
    //
    //   return {
    //     indexViewPath
    //   };
  }
}

export function getDemoIndexPathForType(type: SupportedDemoType): string {
  switch (type) {
    case 'xml':
      return 'src/main-page.xml';
    case 'angular':
      return 'src/home.component.ts';
  }
}

export function getPackagesForIndex(tree: Tree, packages?: Array<string>, addingNew?: boolean) {
  if (addingNew) {
    // just add to all packages
    const allPackages = <Array<string>>getAllPackages(tree);
    for (const p of packages) {
      if (!allPackages.includes(p)) {
        allPackages.push(p);
      }
    }
    packages = allPackages;
  } else {
    // isolate to packages or fallback to all
    packages = packages && packages.length ? packages : getAllPackages(tree);
  }
  return packages;
}

export function resetAngularIndex(tree: Tree, packages?: Array<string>, addingNew?: boolean) {
  const angularIndexPath = `${getDemoAppRoot('angular')}/${getDemoIndexPathForType('angular')}`;
  let angularIndex = tree.read(angularIndexPath).toString();
  const demosIndex = angularIndex.indexOf('[');
  packages = getPackagesForIndex(tree, packages, addingNew);

  angularIndex =
    angularIndex.substring(0, demosIndex + 1) +
    packages
      .sort()
      .map((p) => `\n	{\n		name: '${p}'\n	}`)
      .join(',') +
    '\n];\n}';
  tree.write(angularIndexPath, angularIndex);
}

export function resetAngularRoutes(tree: Tree, packages?: Array<string>, addingNew?: boolean) {
  const angularRouteModulePath = `${getDemoAppRoot('angular')}/src/app-routing.module.ts`;
  let angularRouteModule = tree.read(angularRouteModulePath).toString();
  const routeDefIndex = angularRouteModule.indexOf('const routes');
  const routeModuleStart = angularRouteModule.substring(0, routeDefIndex);
  const routeMoudleDefIndex = angularRouteModule.indexOf('@NgModule');
  const routeModuleEnd = angularRouteModule.substring(routeMoudleDefIndex, angularRouteModule.length);
  packages = getPackagesForIndex(tree, packages, addingNew);

  const packageRoutes =
    packages
      .sort()
      .map((p) => `	{ path: '${p}', loadChildren: () => import('./plugin-demos/${p}.module').then(m => m.${stringUtils.classify(p)}Module) }`)
      .join(',\n') + '\n];\n\n';
  const routeStart = `const routes: Routes = [
   { path: '', redirectTo: '/home', pathMatch: 'full' },
   { path: 'home', component: HomeComponent },\n`;
  angularRouteModule = routeModuleStart + routeStart + packageRoutes + routeModuleEnd;
  // console.log('angularRouteModule:', angularRouteModule);
  tree.write(angularRouteModulePath, angularRouteModule);
}

export function resetIndexForDemoType(tree: Tree, demoType: SupportedDemoType) {
  const packages = getPackageNamesToUpdate();
  switch (demoType) {
    case 'angular':
      resetAngularIndex(tree, packages);
      resetAngularRoutes(tree, packages);
      break;
    case 'xml':
      const demoIndexPath = getDemoIndexPathForType(demoType);
      const demoIndexFullPath = `${getDemoAppRoot(demoType)}/${demoIndexPath}`;
      if (tree.exists(demoIndexFullPath)) {
        const indexStringData = tree.read(demoIndexFullPath).toString();
        xml2js.parseString(indexStringData, (err, indexData: any) => {
          // console.log('indexData:', indexData);
          if (indexData && indexData.Page) {
            if (indexData.Page.StackLayout) {
              const stackLayout = indexData.Page.StackLayout[0];
              if (stackLayout && stackLayout.ScrollView) {
                const scrollView = stackLayout.ScrollView[0];
                if (scrollView && scrollView.StackLayout) {
                  const buttons = scrollView.StackLayout[0].Button;
                  const buttonStructure = buttons[0];
                  // console.log('buttonStructure:', buttonStructure);
                  // console.log('buttons:', buttons);
                  scrollView.StackLayout[0].Button = [];
                  if (packages.length === 0) {
                    // resetting to include buttons for all packages
                    for (const p of getAllPackages(tree)) {
                      scrollView.StackLayout[0].Button.push({
                        $: {
                          ...buttonStructure.$,
                          text: p,
                        },
                      });
                    }
                  } else {
                    // focus on specific packages for demo testing
                    for (const p of packages) {
                      scrollView.StackLayout[0].Button.push({
                        $: {
                          ...buttonStructure.$,
                          text: p,
                        },
                      });
                    }
                  }

                  const xmlBuilder = new xml2js.Builder({
                    headless: true,
                  });
                  const modifiedIndex = xmlBuilder.buildObject(indexData);
                  // console.log('modifiedIndex:', modifiedIndex);
                  tree.write(demoIndexFullPath, modifiedIndex);
                }
              }
            }
          }
        });
      }
      break;
  }
}
