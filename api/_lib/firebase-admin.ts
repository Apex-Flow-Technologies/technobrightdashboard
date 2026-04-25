import admin from 'firebase-admin';

const initAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT is missing');
    return null;
  }

  try {
    let serviceAccount = JSON.parse(serviceAccountRaw);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('❌ Firebase Admin Init Error:', error);
    return null;
  }
};

// We don't export auth/db directly at top level to avoid crash if init fails
export const getAdminAuth = () => {
  initAdmin();
  return admin.auth();
};

export const getAdminDb = () => {
  initAdmin();
  return admin.firestore();
};

export default admin;
