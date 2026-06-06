import admin from 'firebase-admin';

const initAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) {
    throw new Error('BACKEND_ERROR: FIREBASE_SERVICE_ACCOUNT variable is missing in Vercel settings.');
  }

  try {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch (parseErr) {
      throw new Error('BACKEND_ERROR: FIREBASE_SERVICE_ACCOUNT is not valid JSON. Please re-copy from your file.');
    }

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    if (error.message.startsWith('BACKEND_ERROR:')) throw error;
    throw new Error(`BACKEND_ERROR: Firebase Init Failed: ${error.message}`);
  }
};

export const getAdminAuth = () => {
  initAdmin();
  return admin.auth();
};

export const getAdminDb = () => {
  initAdmin();
  return admin.firestore();
};

export const verifyAdmin = async (req: any, targetUid?: string) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing token');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await getAdminAuth().verifyIdToken(token);

  const db = getAdminDb();
  const userSnap = await db.collection('user').where('uid', '==', decodedToken.uid).get();

  if (userSnap.empty) {
    throw new Error('Unauthorized: User not found in database');
  }

  const userData = userSnap.docs[0].data();
  
  // Allow access if the user is an admin or manager, OR if the request is targeting their own user record
  if (userData.role !== 'admin' && userData.role !== 'manager' && (!targetUid || decodedToken.uid !== targetUid)) {
    throw new Error('Unauthorized: Insufficient permissions');
  }

  return decodedToken;
};

export default admin;
