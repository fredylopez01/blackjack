export default {
  testEnvironment: "node",
  transform: {},
  moduleNameMapper: {
    "^@prisma/client$": "<rootDir>/tests/mocks/prismaClient.js",
  },
  testTimeout: 10000,
  verbose: true,
  // Evitar que Jest intente ejecutar el index.js
  testPathIgnorePatterns: ["/node_modules/", "/src/index.js"],
};
