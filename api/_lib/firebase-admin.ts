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

export default admin;
