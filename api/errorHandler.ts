import { Request, Response, NextFunction } from 'express';

function logError(err: Error) {
    console.error(err)
}

function logErrorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
    logError(err)
    next(err)
}

function returnError(err: Error, req: Request, res: Response, next: NextFunction): void {
    res.status((err as any).status || 500).send({
      status: (err as any).status || 'error',
      message: err.message || 'Internal Server Error'
    });
  }

export { logErrorMiddleware, returnError };