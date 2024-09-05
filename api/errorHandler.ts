import { Request, Response, NextFunction } from 'express';

function logError(err: Error) {
   
    console.error(err);
}

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
    logError(err);

    res.status((err as any).status || 500).json({
        status: (err as any).status || 'error',
        message: err.message || 'Internal Server Error'
    });
}

export { errorHandler };
