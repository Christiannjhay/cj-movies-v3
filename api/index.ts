import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import passport from 'passport';
const LocalStrategy = require('passport-local').Strategy;
import { User } from '../types/supabase';


dotenv.config();
const app = express();
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT || 3000;
const apiKey = process.env.VITE_REACT_APP_MOVIE_API_TOKEN;

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cookieParser());
app.use(cors({
  origin: 'https://cj-movies.vercel.app', 
  credentials: true,
}));
app.use(express.json());



// Initialize express-session
app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      sameSite: 'lax', // or 'strict' if you want more security
    },
  })
);
// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());


// Define a local strategy
passport.use(
  new LocalStrategy(
    async (username: string, password: string, done: (error: any, user?: User | false, options?: { message: string }) => void) => {
      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (error || !user) {
          return done(null, false, { message: 'Incorrect username or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return done(null, false, { message: 'Incorrect username or password.' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Serialize user to store in session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return done(error, null);
    }

    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existingUser) {
      return res.status(409).json({ error: 'Username already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword }])
      .select();

    if (error) {
      throw error;
    }

    res.status(201).json({ message: 'User registered successfully', user: data });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login endpoint
app.post('/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: any, user: User | false, info: { message: any }) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ error: info.message });
    }
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      console.log('User logged in:', user);
      console.log('Session:', req.session); // Check session details
      return res.status(200).json({ message: 'Logged in successfully', user });
    });
  })(req, res, next);
});

app.post('/bookmark', async (req: Request, res: Response) => {
  const { movieId } = req.body;

  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = (req.user as User).id;

  try {
    const { data: existingBookmark, error: fetchError } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('movie_id', movieId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // code 'PGRST116' indicates no record found
      throw fetchError;
    }

    if (existingBookmark) {
      // Bookmark already exists, return a success message without adding a new entry
      return res.status(200).json({ message: 'Movie already bookmarked' });
    }

    // Insert the new bookmark
    const { data, error } = await supabase
      .from('bookmarks')
      .insert([{ user_id: userId, movie_id: movieId }]);

    if (error) {
      throw error;
    }

    res.status(201).json({ message: 'Movie bookmarked successfully', bookmark: data });
  } catch (err) {
    console.error('Error bookmarking movie:', err);
    res.status(500).json({ message: 'Failed to bookmark movie' });
  }
});

app.get('/bookmarked-movies', async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = (req.user as User).id;

  try {
    // Fetch the movie IDs bookmarked by the authenticated user
    const { data: bookmarks, error: fetchError } = await supabase
      .from('bookmarks')
      .select('movie_id')
      .eq('user_id', userId);

    if (fetchError) {
      throw fetchError;
    }

    if (!bookmarks || bookmarks.length === 0) {
      return res.status(200).json({ movies: [] });
    }

    // Fetch details for each movie
    const movieDetailsPromises = bookmarks.map(async (bookmark) => {
      const url = `https://api.themoviedb.org/3/movie/${bookmark.movie_id}?language=en-US`;
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      };

      try {
        const response = await fetch(url, options);
        const movieDetails = await response.json();

        
        const processedMovie = {
          id: movieDetails.id,
          title: movieDetails.title,
          overview: movieDetails.overview,
          poster_path: movieDetails.poster_path,
          release_date: movieDetails.release_date,
          runtime: movieDetails.runtime,
          vote_average: movieDetails.vote_average.toFixed(1), 
          vote_count: movieDetails.vote_count,
          production_countries: movieDetails.production_countries
            ?.slice(0, 3)
            .map((country: { name: string }) => country.name) || [],
          genres: movieDetails.genres
            ?.slice(0, 3)
            .map((genre: { name: string }) => genre.name) || [],
        };

        return processedMovie;
      } catch (err) {
        console.error(`Error fetching movie details for ID ${bookmark.movie_id}:`, err);
        return null;
      }
    });

    const movieDetails = await Promise.all(movieDetailsPromises);

    // Filter out null values if any
    const validMovies = movieDetails.filter((movie) => movie !== null);

    res.status(200).json({ movies: validMovies });
  } catch (err) {
    console.error('Error fetching user-bookmarked movies:', err);
    res.status(500).json({ message: 'Failed to fetch user-bookmarked movies' });
  }
});

app.get('/profile', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    // req.user will be populated with user data if authenticated
    res.json({ message: 'You are logged in', user: req.user });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

app.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }

    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Error destroying session' });
      }

      // Send a response to indicate logout was successful
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
});


app.get('/popular', async (req: Request, res: Response, next: NextFunction) => {
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

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
