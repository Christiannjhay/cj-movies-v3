// tests/errorMiddleware.test.ts

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { errorHandler } from '../api/errorHandler';

describe('Error Handling Middleware', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();

    app.get('/error', (req: Request, res: Response, next: NextFunction) => {
      const error = new Error('Test Error');
      (error as any).status = 400;
      next(error);
    });

    
    app.get('/error500', (req: Request, res: Response, next: NextFunction) => {
      const error = new Error('Some error');
      next(error);
    });

    // Apply the error-handling middleware
    app.use(errorHandler);
  });

  it('should log the error and return a 400 status', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const response = await request(app).get('/error');
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: 'Test Error',
    });

    consoleSpy.mockRestore();
  });

  it('should return 500 if no status is provided', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).get('/error500');
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Some error',
    });

    consoleSpy.mockRestore();
  });
});
