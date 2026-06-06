import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb, verifyAdmin } from '../_lib/firebase-admin.js';
import admin from 'firebase-admin';
import { z } from 'zod';

const UserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['technician', 'manager', 'user', 'admin']),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  legacyCustomerId: z.any().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyAdmin(req);
    const { users } = z.object({ users: z.array(UserSchema) }).parse(req.body);
    const results = { success: 0, failed: 0, errors: [] as any[] };

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Process in sequential loop to avoid hitting Firebase Auth rate limits
    for (const userData of users) {
      try {
        const { username, password, role, name, ...otherData } = userData;
        const virtualEmail = `${username.toLowerCase()}@apex-internal.com`;
        const userEmail = userData.email || virtualEmail;

        // 1. Create User in Firebase Authentication
        const authRecord = await auth.createUser({
          email: userEmail,
          password: password,
          displayName: name,
        });

        // 2. Create User Document in Firestore
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

        await db.collection('user').add(userDoc);
        results.success++;
      } catch (err: any) {
        console.error(`Bulk upload failed for user "${userData.username}":`, err);
        results.failed++;
        results.errors.push({ username: userData.username, error: err.message });
      }
    }

    return res.json(results);
  } catch (error: any) {
    console.error('Error in bulk create user function:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
