const admin = require('firebase-admin');

let firebaseAdmin;

const initFirebase = () => {
  if (firebaseAdmin) return firebaseAdmin;

  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    if (!admin.apps.length) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      firebaseAdmin = admin.apps[0];
    }

    console.log('✓ Firebase Admin initialized');
    return firebaseAdmin;
  } catch (err) {
    console.warn('⚠ Firebase Admin init failed (running without Firebase):', err.message);
    return null;
  }
};

const verifyFirebaseToken = async (idToken) => {
  try {
    const app = initFirebase();
    if (!app) return null;
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    console.error('Firebase token verify error:', err.message);
    return null;
  }
};

module.exports = { initFirebase, verifyFirebaseToken, admin };
