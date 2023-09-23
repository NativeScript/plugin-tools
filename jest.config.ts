const { getJestProjects } = require('@nx/jest');

export default { projects: [...getJestProjects(), '<rootDir>/e2e/plugin-tools-e2e'] };
