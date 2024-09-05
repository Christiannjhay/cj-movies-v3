import express, { Request, Response } from 'express';
import request from 'supertest';
import supabase from '../__mocks__/supabase'; 
import bcrypt from '../__mocks__/bcrypt';


jest.mock('supabase', () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockReturnThis(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));


const app = express();
app.use(express.json());


app.post('/register', async (req: Request, res: Response) => {
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

describe('POST /register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a new user', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue({ data: [{ username: 'testUser' }], error: null }),
    });
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    const response = await request(app)
      .post('/register')
      .send({ username: 'testUser', password: 'password' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'User registered successfully');
    expect(response.body.user[0]).toHaveProperty('username', 'testUser');
  });

  it('should return 409 if username is already registered', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { username: 'testUser' }, error: null }),
    });
    
    const response = await request(app)
      .post('/register')
      .send({ username: 'testUser', password: 'password' });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('error', 'Username already registered');
  });

  it('should return 500 if there is a server error', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockRejectedValue(new Error('Database error')),
    });

    const response = await request(app)
      .post('/register')
      .send({ username: 'testUser', password: 'password' });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error', 'Failed to register user');
  });
});
