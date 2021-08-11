const { getJestProjects } = require('@nrwl/jest');

module.exports = { projects: [...getJestProjects(), '<rootDir>/e2e/plugin-tools-e2e'] };
