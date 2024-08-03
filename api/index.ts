import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logErrorMiddleware, returnError } from './errorHandler';
import dotenv from 'dotenv';
import admin from '../firebaseAdmin';
import jwt, { JwtPayload } from 'jsonwebtoken';
import cookieParser from 'cookie-parser'
import authenticateToken from '../middleware/authenticateToken';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.VITE_REACT_APP_MOVIE_API_TOKEN;
const jwtSecret = process.env.JWT_SECRET || 'secret';

app.use(cookieParser());

console.log('API Key:', apiKey);

app.use(cors());
app.use(express.json());


app.post('/api/register', async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });
    res.status(201).json({ uid: userRecord.uid });
  } catch (error) {
    next(error);
  }
});


app.post('/api/login', async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  try {
   
    const user = await admin.auth().getUserByEmail(email);
    
   
    const token = jwt.sign({ uid: user.uid }, jwtSecret, { expiresIn: '1h' });

 
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000, 
      sameSite: 'strict' 
    });

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    next(error);
  }
});


app.get('/api/popular', async (req: Request, res: Response, next) => {
  try {
    const url = 'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1';
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`

      }
    };

    const response = await fetch(url, options);
    const json = await response.json();


    res.status(200).json(json);
  } catch (error) {
    next(error);
  }
});



app.get('/api/protected', authenticateToken, (req: Request, res: Response) => {
  const user = (req as Request & { user?: JwtPayload }).user;
  res.json({ message: 'This is a protected route', user });
});

app.use(logErrorMiddleware)
app.use(returnError)

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});