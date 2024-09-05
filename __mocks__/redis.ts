// __mocks__/redis.ts
const mockSet = jest.fn().mockResolvedValue('OK');
const mockGet = jest.fn().mockResolvedValue('testValue');

const MockRedis = {
  createClient: jest.fn(() => ({
    set: mockSet,
    get: mockGet
  }))
};

export default MockRedis;
