
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'secret';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    (req as RequestWithUser).user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export default authenticateToken;