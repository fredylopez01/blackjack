// tests/mocks/prismaClient.js

const noop = () => Promise.resolve(null);

export const mockPrismaClient = {
  user: {
    findUnique: noop,
    findMany: noop,
    create: noop,
    update: noop,
    delete: noop,
    upsert: noop,
  },
  gameSession: {
    findUnique: noop,
    findMany: noop,
    create: noop,
    update: noop,
    delete: noop,
    upsert: noop,
  },
  playerSession: {
    findUnique: noop,
    findMany: noop,
    create: noop,
    update: noop,
    delete: noop,
    upsert: noop,
  },
  $connect: noop,
  $disconnect: noop,
  $transaction: (callback) => callback(mockPrismaClient),
};

export class PrismaClient {
  constructor() {
    Object.assign(this, mockPrismaClient);
  }
}

export default { PrismaClient };
