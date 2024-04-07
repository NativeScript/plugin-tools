import { checkFilesExist, ensureNxProject, readJson, runNxCommandAsync, uniq } from '@nx/plugin/testing';
describe('plugin-tools e2e', () => {
  it('should create plugin-tools', async () => {
    const plugin = uniq('plugin-tools');
    ensureNxProject('@nativescript/plugin-tools', 'dist/packages/plugin-tools');
    await runNxCommandAsync(`generate @nativescript/plugin-tools:plugin-tools ${plugin}`);

    const result = await runNxCommandAsync(`build ${plugin}`);
    expect(result.stdout).toContain('Executor ran');
  }, 120000);

  describe('--directory', () => {
    it('should create src in the specified directory', async () => {
      const plugin = uniq('plugin-tools');
      ensureNxProject('@nativescript/plugin-tools', 'dist/packages/plugin-tools');
      await runNxCommandAsync(`generate @nativescript/plugin-tools:plugin-tools ${plugin} --directory subdir`);
      expect(() => checkFilesExist(`libs/subdir/${plugin}/src/index.ts`)).not.toThrow();
    }, 120000);
  });

  describe('--tags', () => {
    it('should add tags to nx.json', async () => {
      const plugin = uniq('plugin-tools');
      ensureNxProject('@nativescript/plugin-tools', 'dist/packages/plugin-tools');
      await runNxCommandAsync(`generate @nativescript/plugin-tools:plugin-tools ${plugin} --tags e2etag,e2ePackage`);
      const nxJson = readJson('nx.json');
      expect(nxJson.projects[plugin].tags).toEqual(['e2etag', 'e2ePackage']);
    }, 120000);
  });
});
