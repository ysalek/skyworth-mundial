// File: scripts/setAdmin.js
// Ejecutar con: node scripts/setAdmin.js <email_o_uid>
// Requiere Service Account Key descargada de Firebase Console

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json'); // DESCAGAR DE FIREBASE CONSOLE

if (process.argv.length < 3) {
  console.error('Uso: node scripts/setAdmin.js <email_o_uid>');
  process.exit(1);
}

const identifier = process.argv[2];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdminClaim(id) {
  try {
    let user;
    if (id.includes('@')) {
      user = await admin.auth().getUserByEmail(id);
    } else {
      user = await admin.auth().getUser(id);
    }
    
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    
    console.log(`SUCCESS: Usuario con UID ${user.uid} (${user.email}) ahora es ADMIN.`);
    console.log('El usuario debe cerrar sesión y volver a entrar para actualizar sus permisos.');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

setAdminClaim(identifier);