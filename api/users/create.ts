import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../_lib/firebase-admin.js';
import admin from 'firebase-admin';
import { z } from 'zod';

const UserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['technician', 'manager', 'user']),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  legacyCustomerId: z.any().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = UserSchema.parse(req.body);
    const { username, password, role, name, ...otherData } = data;

    const virtualEmail = `${username.toLowerCase()}@apex-internal.com`;
    const userEmail = data.email || virtualEmail;

    const authRecord = await getAdminAuth().createUser({
      email: userEmail,
      password: password,
      displayName: name,
    });

    const userDoc = {
      uid: authRecord.uid,
      username: username.toLowerCase(),
      name,
      role,
      email: userEmail,
      ...otherData,
      status: 'offline',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await getAdminDb().collection('user').add(userDoc);

    return res.json({ success: true, uid: authRecord.uid });
  } catch (error: any) {
    console.error('Error in create user function:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
