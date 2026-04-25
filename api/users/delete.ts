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
    const { id, uid } = req.body;
    if (!id) return res.status(400).json({ error: 'Firestore Document ID is required' });

    if (uid) {
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr: any) {
        console.warn('Auth deletion failed (user might not exist in Auth):', authErr.message);
      }
    }

    await adminDb.collection('user').doc(id).delete();

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
