import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json'

const serviceAccountConfig = serviceAccount as admin.ServiceAccount;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountConfig)
});

export default admin;