import { addProjectConfiguration, getWorkspaceLayout, NxJsonConfiguration, readJson, Tree, updateJson, writeJson } from '@nx/devkit';
import { createTree, createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update300 from './update-3-0-0';

describe('update-3-0-0', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'workspace.json',
      `{
      "version": 2,
      "projects": {
        "demo": {
          "root": "apps/demo/",
          "sourceRoot": "apps/demo/src",
          "projectType": "application",
          "prefix": "demo",
          "targets": {
            "build": {
              "executor": "@nativescript/nx:build",
              "options": {
                "noHmr": true,
                "production": true,
                "uglify": true,
                "release": true,
                "forDevice": true
              }
            },
            "ios": {
              "executor": "@nativescript/nx:build",
              "options": {
                "platform": "ios"
              }
            },
            "android": {
              "executor": "@nativescript/nx:build",
              "options": {
                "platform": "android"
              }
            },
            "clean": {
              "executor": "@nativescript/nx:build",
              "options": {
                "clean": true
              }
            }
          }
        },
        "demo-angular": {
          "root": "apps/demo-angular/",
          "sourceRoot": "apps/demo-angular/src",
          "projectType": "application",
          "prefix": "demo",
          "targets": {
            "build": {
              "executor": "@nativescript/nx:build",
              "options": {
                "noHmr": true,
                "production": true,
                "uglify": true,
                "release": true,
                "forDevice": true
              }
            },
            "ios": {
              "executor": "@nativescript/nx:build",
              "options": {
                "platform": "ios"
              }
            },
            "android": {
              "executor": "@nativescript/nx:build",
              "options": {
                "platform": "android"
              }
            },
            "clean": {
              "executor": "@nativescript/nx:build",
              "options": {
                "clean": true
              }
            }
          }
        },
        "all": {
          "root": "",
          "projectType": "application",
          "targets": {
            "build": {
              "outputs": [
                "dist/packages"
              ],
              "options": {
                "commands": [
                  
                ],
                "parallel": false
              },
              "executor": "@nx/workspace:run-commands"
            },
            "focus": {
              "outputs": [
                "dist/packages"
              ],
              "options": {
                "commands": [
                  "nx g @nativescript/plugin-tools:focus-packages"
                ],
                "parallel": false
              },
              "executor": "@nx/workspace:run-commands"
            }
          },
          "sourceRoot": ""
        }
      },
      "cli": {
        "defaultCollection": "@nx/workspace"
      }
    }`
    );
    tree.write(
      'nx.json',
      `{
      "npmScope": "nativescript",
      "affected": {
        "defaultBase": "master"
      },
      "implicitDependencies": {
        "workspace.json": "*",
        "package.json": {
          "dependencies": "*",
          "devDependencies": "*"
        },
        "tsconfig.base.json": "*",
        "tslint.json": "*",
        "nx.json": "*"
      },
      "projects": {
        "demo": {
          "tags": [
            
          ]
        },
        "demo-angular": {
          "tags": [
            
          ]
        },
        "all": {
          "tags": [
            
          ]
        }
      },
      "workspaceLayout": {
        "appsDir": "apps",
        "libsDir": "packages"
      }
    }`
    );
    tree.write(
      `tsconfig.base.json`,
      `{
      "compilerOptions": {
        "rootDir": ".",
        "sourceMap": true,
        "declaration": true,
        "moduleResolution": "node",
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "noEmitHelpers": false,
        "target": "es2019",
        "module": "esnext",
        "lib": [
          "es2019",
          "dom"
        ],
        "skipLibCheck": true,
        "skipDefaultLibCheck": true,
        "baseUrl": ".",
        "plugins": [
          {
            "transform": "@nativescript/webpack/dist/transformers/NativeClass",
            "type": "raw"
          }
        ],
        "paths": {
          "@demo/shared": [
            "tools/demo/index.ts"
          ],
          "@nativescript/*": [
            "packages/*"
          ]
        }
      },
      "exclude": [
        "node_modules",
        "tmp"
      ]
    }`
    );
    // addProjectConfiguration(tree, 'demo', {
    //   projectType: "application",
    //   root: 'apps/demo',
    // });

    addProjectConfiguration(tree, 'nativescript-sample-plugin', {
      projectType: 'library',
      root: 'packages/nativescript-sample-plugin',
    });
    addProjectConfiguration(tree, 'nativescript-angular-plugin', {
      projectType: 'library',
      root: 'packages/nativescript-angular-plugin',
    });
    // write a dummy index
    tree.write('packages/nativescript-angular-plugin/angular/index.ts', '');
    tree.write('packages/nativescript-sample-plugin/package.json', '{ "name": "@nativescript/nativescript-sample-plugin", "main": "index" }');
    tree.write('packages/nativescript-sample-plugin/index.d.ts', '');
    tree.write('packages/nativescript-angular-plugin/package.json', '{ "name": "@nativescript/nativescript-angular-plugin", "main": "other" }');
    tree.write('packages/nativescript-angular-plugin/other.ts', '');

    tree.write(
      'tools/workspace-scripts.js',
      `const npsUtils = require('nps-utils');

    module.exports = {
      message: 'NativeScript Plugins ~ made with ❤️  Choose a command to start...',
      pageSize: 32,
      scripts: {
        '@nativescript': {
            'build-all': {
            script: 'nx run all:build',
            description: 'Build all packages',
          },
        },
        focus: {
          reset: {
            script: 'nx run all:focus',
            description: 'Reset Focus',
          },
        }
      }
    };`
    );

    tree.write(
      'apps/demo/tsconfig.json',
      `{
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "rootDirs": [
          ".",
          "../.."
        ],
        "baseUrl": ".",
        "paths": {
          "~/*": [
            "src/*"
          ],
          "@demo/shared": [
            "../../tools/demo/index.ts"
          ],
          "@nativescript/*": [
            "../../packages/*"
          ]
        }
      }
    }`
    );
    tree.write(
      'apps/demo-angular/tsconfig.json',
      `{
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "rootDirs": [
          ".",
          "../.."
        ],
        "baseUrl": ".",
        "paths": {
          "~/*": [
            "src/*"
          ],
          "@demo/shared": [
            "../../tools/demo/index.ts"
          ],
          "@nativescript/*": [
            "../../dist/packages/*"
          ]
        }
      },
      "files": [
        "./references.d.ts",
        "./src/main.ts",
        "./src/polyfills.ts"
      ]
    }`
    );

    // addProjectConfiguration(tree, 'all', {
    //   root: '',
    // });
  });

  it('should correctly update files', async () => {
    // console.log(tree.read('nx.json', 'utf8'));
    // console.log(getWorkspaceLayout(tree));
    // console.log(tree.read('workspace.json', 'utf8'));
    // expect(false).toBe(true);
    await update300(tree);
    expect(tree.exists('packages/nativescript-sample-plugin/.eslintrc.json')).toBe(true);
    expect(tree.exists('packages/nativescript-sample-plugin/angular/.eslintrc.json')).toBe(false);
    expect(tree.exists('packages/nativescript-angular-plugin/.eslintrc.json')).toBe(true);
    expect(tree.exists('packages/nativescript-angular-plugin/angular/.eslintrc.json')).toBe(true);
    expect(tree.exists('apps/demo/.eslintrc.json')).toBe(true);
    expect(tree.exists('apps/demo-angular/.eslintrc.json')).toBe(true);
    // console.log(tree.read('tsconfig.base.json', 'utf8'));
    // console.log(tree.read('apps/demo/tsconfig.json', 'utf8'));
    // console.log(tree.read('apps/demo-angular/tsconfig.json', 'utf8'));

    expect(tree.read('tools/workspace-scripts.js', 'utf-8')).toEqual(`const npsUtils = require('nps-utils');

    module.exports = {
      message: 'NativeScript Plugins ~ made with ❤️  Choose a command to start...',
      pageSize: 32,
      scripts: {
        '@nativescript': {
            'build-all': {
            script: 'nx run-many --target=build.all --all',
            description: 'Build all packages',
          },
        },
        focus: {
          reset: {
            script: 'nx g @nativescript/plugin-tools:focus-packages',
            description: 'Reset Focus',
          },
        }
      }
    };`);

    expect(JSON.parse(tree.read('tsconfig.base.json', 'utf-8'))).toEqual({
      compilerOptions: {
        rootDir: '.',
        sourceMap: true,
        declaration: true,
        moduleResolution: 'node',
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        noEmitHelpers: false,
        target: 'es2019',
        module: 'esnext',
        lib: ['es2019', 'dom'],
        skipLibCheck: true,
        skipDefaultLibCheck: true,
        baseUrl: '.',
        plugins: [
          {
            transform: '@nativescript/webpack/dist/transformers/NativeClass',
            type: 'raw',
          },
        ],
        paths: {
          '@demo/shared': ['tools/demo/index.ts'],
          '@nativescript/nativescript-sample-plugin': ['packages/nativescript-sample-plugin/index.d.ts'],
          '@nativescript/nativescript-angular-plugin': ['packages/nativescript-angular-plugin/other.ts'],
          '@nativescript/nativescript-angular-plugin/angular': ['packages/nativescript-angular-plugin/angular/index.ts'],
        },
      },
      exclude: ['node_modules', 'tmp'],
    });

    expect(JSON.parse(tree.read('apps/demo/tsconfig.json', 'utf-8'))).toEqual({
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        rootDirs: ['.', '../..'],
        baseUrl: '.',
        paths: {
          '~/*': ['src/*'],
          '@demo/shared': ['../../tools/demo/index.ts'],
          '@nativescript/nativescript-sample-plugin': ['../../packages/nativescript-sample-plugin/index.d.ts'],
          '@nativescript/nativescript-angular-plugin': ['../../packages/nativescript-angular-plugin/other.ts'],
          '@nativescript/nativescript-angular-plugin/angular': ['../../packages/nativescript-angular-plugin/angular/index.ts'],
        },
      },
    });

    expect(JSON.parse(tree.read('apps/demo-angular/tsconfig.json', 'utf-8'))).toEqual({
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        paths: {
          '~/*': ['src/*'],
          '@demo/shared': ['tools/demo/index.ts'],
          '@nativescript/nativescript-sample-plugin': ['packages/nativescript-sample-plugin/index.d.ts'],
          '@nativescript/nativescript-angular-plugin': ['packages/nativescript-angular-plugin/other.ts'],
          '@nativescript/nativescript-angular-plugin/angular': ['packages/nativescript-angular-plugin/angular/index.ts'],
        },
      },
      files: ['./references.d.ts', './src/main.ts', './src/polyfills.ts'],
      include: ['../../packages/**/references.d.ts'],
    });
  });
});
