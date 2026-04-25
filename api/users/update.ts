import { VercelRequest, VercelResponse } from '@vercel/node';
import { adminAuth, adminDb } from '../_lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { id, uid, ...updates } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID is required' });

    const authUpdates: any = {};
    if (updates.password && updates.password.length >= 6) {
      authUpdates.password = updates.password;
    }
    if (updates.name) {
      authUpdates.displayName = updates.name;
    }
    
    let targetEmail = updates.email;
    if (!targetEmail && updates.username) {
        targetEmail = `${updates.username.toLowerCase()}@apex-internal.com`;
    }

    if (targetEmail) {
        const currentAuthUser = await adminAuth.getUser(uid);
        if (currentAuthUser.email !== targetEmail) {
            authUpdates.email = targetEmail;
        }
    }

    if (Object.keys(authUpdates).length > 0) {
      await adminAuth.updateUser(uid, authUpdates);
    }

    const firestoreUpdates = { ...updates };
    if (updates.username) firestoreUpdates.username = updates.username.toLowerCase();
    delete firestoreUpdates.password;

    const userRef = adminDb.collection('user').doc(id);
    await userRef.update(firestoreUpdates);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
