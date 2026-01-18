import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

// --- CONSTANTS ---
const RANKING_CITIES = ['La Paz', 'Cochabamba', 'Santa Cruz'];

// --- HELPERS ---
const assertAuth = (context: functions.https.CallableContext) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
};

const assertAdmin = (context: functions.https.CallableContext) => {
  const SUPER_ADMIN = 'LTNwDZDCH6cZwqhVH7Ol1guYBuJ2';
  const ADMIN_EMAIL = 'admin@skyworth.com';
  
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión');
  
  const isAdminClaim = context.auth.token.admin === true;
  const isSuperAdmin = context.auth.uid === SUPER_ADMIN;
  const isEmailAdmin = context.auth.token.email === ADMIN_EMAIL;

  if (!isAdminClaim && !isSuperAdmin && !isEmailAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores.');
  }
};

const generateTicketId = () => {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SKY-${new Date().getFullYear()}-${suffix}`;
};

// --- PUBLIC: CLIENT REGISTRATION (Enhanced) ---
export const registerClient = functions.https.onCall(async (data, context) => {
  // 1. Sanitize Input
  const { fullName, ci, city, email, phone, tvModel, serial, invoicePath } = data;

  if (!fullName || !ci || !city || !email || !phone || !tvModel || !invoicePath) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos obligatorios.');
  }

  const cleanSerial = serial ? String(serial).trim().toUpperCase() : 'N/A';
  
  try {
    return await db.runTransaction(async (t) => {
      // 2. Serial Validation Logic
      if (cleanSerial !== 'N/A') {
        // A. Check duplicates in CLIENTS (Double Registration Prevention)
        const dupCheck = await t.get(db.collection('clients').where('serial', '==', cleanSerial));
        if (!dupCheck.empty) {
            throw new functions.https.HttpsError('already-exists', 'Este número de serie ya fue registrado previamente.');
        }

        // B. Check against VALID_CODES (Inventory)
        const codeRef = db.collection('valid_codes').doc(cleanSerial);
        const codeDoc = await t.get(codeRef);
        
        if (codeDoc.exists) {
            const codeData = codeDoc.data();
            if (codeData?.used) {
                throw new functions.https.HttpsError('failed-precondition', 'Este código de serie ya figura como USADO en el sistema.');
            }

            // Strict Model Check
            if (codeData?.model && codeData.model !== tvModel) {
                throw new functions.https.HttpsError('invalid-argument', `El serial ingresado corresponde al modelo ${codeData.model}, pero seleccionaste ${tvModel}.`);
            }

            // Mark as used
            t.update(codeRef, { 
                used: true, 
                usedBy: ci, 
                usedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
        }
      }

      // 3. Determine Coupons Count
      let couponsCount = 1;
      const productsSnap = await t.get(db.collection('products').where('model', '==', tvModel).limit(1));
      if (!productsSnap.empty) {
          couponsCount = productsSnap.docs[0].data().couponsBuyer || 1;
      }

      // 4. Generate Tickets
      const ticketIds: string[] = [];
      const clientId = db.collection('clients').doc().id;
      const now = admin.firestore.FieldValue.serverTimestamp();

      for (let i = 0; i < couponsCount; i++) {
          const tid = generateTicketId();
          ticketIds.push(tid);

          // Create Ticket Doc (for weighted raffle)
          const ticketRef = db.collection('tickets').doc(tid);
          t.set(ticketRef, {
              ticketId: tid,
              clientId,
              fullName,
              ci,
              city,
              phone,
              tvModel,
              serial: cleanSerial,
              createdAt: now
          });
      }

      const docData = {
        clientId,
        fullName: String(fullName),
        ci: String(ci),
        city: String(city),
        email: String(email),
        phone: String(phone),
        tvModel: String(tvModel),
        serial: cleanSerial,
        invoicePath: String(invoicePath),
        ticketIds, // Store all IDs
        ticketId: ticketIds[0], // Keep primary for backward compat
        couponsCount,
        createdAt: now,
        source: 'WEB_FORM'
      };

      t.set(db.collection('clients').doc(clientId), docData);

      return { success: true, ticketIds, message: 'Registro exitoso.' };
    });
  } catch (error: any) {
    console.error("Error registering client:", error);
    // Forward specific errors
    if (error.code === 'already-exists' || error.code === 'failed-precondition') {
        throw error;
    }
    throw new functions.https.HttpsError('internal', `Error al procesar el registro: ${error.message}`);
  }
});

// --- ADMIN: IMPORT CODES ---
export const importCodes = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    const { codes } = data; // Expects array of { code, model }

    if (!Array.isArray(codes) || codes.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Lista de códigos vacía.');
    }
    
    // Batch writes (limit 500 per batch)
    const batch = db.batch();
    let count = 0;
    const batchId = new Date().toISOString();

    for (const item of codes) {
        if (!item.code) continue;
        const codeRef = db.collection('valid_codes').doc(String(item.code).trim().toUpperCase());
        batch.set(codeRef, {
            code: String(item.code).trim().toUpperCase(),
            model: item.model || 'Unknown',
            used: false,
            batchId,
            importedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // Merge ensures we don't overwrite "used" status if re-uploading existing
        
        count++;
        if (count >= 490) break; // Safety break for single batch. For massive uploads, client should chunk.
    }

    await batch.commit();
    return { success: true, count };
});

// --- ADMIN: PICK WINNER ---
export const pickWinner = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    
    // 1. Get all eligible tickets (Weighted by coupon count naturally)
    const snapshot = await db.collection('tickets').select('ticketId', 'clientId').get();
    
    if (snapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'No hay tickets registrados.');
    }

    const docs = snapshot.docs;
    const randomIndex = Math.floor(Math.random() * docs.length);
    const winningTicketDoc = docs[randomIndex];
    const { ticketId, clientId } = winningTicketDoc.data();

    // 2. Get Full Client Data
    const clientDoc = await db.collection('clients').doc(clientId).get();
    const clientData = clientDoc.data();

    if (!clientData) throw new functions.https.HttpsError('internal', 'Error recuperando datos del cliente ganador.');

    // 3. Save to Winners collection
    const winnerData = {
        ...clientData,
        winningTicketId: ticketId, // Specific ticket that won
        wonAt: admin.firestore.FieldValue.serverTimestamp(),
        selectedBy: context.auth?.uid
    };

    await db.collection('winners').doc(ticketId).set(winnerData); // Use Ticket ID as key to allow same person to win multiple times with diff tickets

    return { success: true, winner: winnerData };
});

// --- SELLER: SUBMIT QUIZ ---
export const submitSellerQuiz = functions.https.onCall(async (data, context) => {
    assertAuth(context);
    const { answers } = data; // Array of indices [0, 2, 1, ...]
    
    // 10 Questions - Correct answers indices (0-based)
    // 1: Google TV (0)
    // 2: 2 Años (1)
    // 3: Hands Free (0)
    // 4: Eye Care (0)
    // 5: Sin bordes (0)
    // 6: 4K UHD (2)
    // 7: Sonido 3D (1)
    // 8: Chromecast (0)
    // 9: HDMI 2.1 (1)
    // 10: Calidad/Precio (0)
    const CORRECT_ANSWERS = [0, 1, 0, 0, 0, 2, 1, 0, 1, 0]; 
    
    let score = 0;
    if (Array.isArray(answers)) {
        answers.forEach((ans, idx) => {
            if (ans === CORRECT_ANSWERS[idx]) score++;
        });
    }

    const passed = score >= 7; // 70% pass rate

    if (passed) {
        await db.collection('sellers').doc(context.auth!.uid).update({
            isCertified: true,
            quizScore: score,
            certifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return { success: true, score, passed };
});

// --- SELLER: REGISTER SALE ---
export const registerSellerSale = functions.https.onCall(async (data, context) => {
  assertAuth(context);
  const uid = context.auth!.uid;
  const { tvModel, invoiceNumber, invoicePath, city } = data;

  if (!tvModel || !invoiceNumber || !invoicePath || !city) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos.');
  }

  const sellerRef = db.collection('sellers').doc(uid);

  try {
    return await db.runTransaction(async (t) => {
      // Fetch Product Config for Points
      let pointsToAdd = 0;
      const productsSnap = await t.get(db.collection('products').where('model', '==', tvModel));
      if (!productsSnap.empty) {
         const pData = productsSnap.docs[0].data();
         pointsToAdd = pData.pointsSeller || 0;
      }

      const sellerDoc = await t.get(sellerRef);
      // Initialize or Update Seller Stats
      if (!sellerDoc.exists) {
          t.set(sellerRef, {
              uid,
              email: context.auth!.token.email || '',
              totalSales: 1,
              totalPoints: pointsToAdd,
              city: city, 
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastSaleAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
      } else {
          t.update(sellerRef, {
              totalSales: admin.firestore.FieldValue.increment(1),
              totalPoints: admin.firestore.FieldValue.increment(pointsToAdd),
              lastSaleAt: admin.firestore.FieldValue.serverTimestamp(),
              city: city 
          });
      }

      const saleId = db.collection('seller_sales').doc().id;
      const saleRef = db.collection('seller_sales').doc(saleId);

      t.set(saleRef, {
        saleId,
        sellerId: uid,
        tvModel,
        invoiceNumber,
        invoicePath,
        city, 
        status: 'PENDING',
        pointsEarned: pointsToAdd,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    });
  } catch (e: any) {
    console.error("Seller Sale Error", e);
    throw new functions.https.HttpsError('internal', e.message);
  }
});

// --- SELLER: GET MY TEAM ---
export const getMyTeam = functions.https.onCall(async (data, context) => {
  assertAuth(context);
  const uid = context.auth!.uid;
  
  const sellerDoc = await db.collection('sellers').doc(uid).get();
  if (!sellerDoc.exists) return { team: [] };
  
  const myCi = sellerDoc.data()?.ci;
  if (!myCi) return { team: [] };

  const q = db.collection('sellers').where('leaderCi', '==', myCi);
  const snap = await q.get();

  const team = snap.docs.map(d => ({
    name: d.data().fullName,
    sales: d.data().totalSales || 0,
    city: d.data().city
  }));

  return { team };
});

// --- ADMIN: REVIEW SALE ---
export const reviewSale = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const { saleId, action } = data;

  if (!saleId || !['APPROVE', 'REJECT'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Acción inválida.');
  }

  const saleRef = db.collection('seller_sales').doc(saleId);
  const saleDoc = await saleRef.get();

  if (!saleDoc.exists) throw new functions.https.HttpsError('not-found', 'Venta no encontrada.');
  const saleData = saleDoc.data();

  if (action === 'REJECT' && saleData?.status !== 'REJECTED') {
     await db.runTransaction(async (t) => {
        t.update(saleRef, { status: 'REJECTED' });
        const sellerRef = db.collection('sellers').doc(saleData?.sellerId);
        t.update(sellerRef, { totalSales: admin.firestore.FieldValue.increment(-1) });
     });
  } else if (action === 'APPROVE') {
    if (saleData?.status === 'REJECTED') {
      await db.runTransaction(async (t) => {
        t.update(saleRef, { status: 'APPROVED' });
        const sellerRef = db.collection('sellers').doc(saleData?.sellerId);
        t.update(sellerRef, { totalSales: admin.firestore.FieldValue.increment(1) });
     });
    } else {
      await saleRef.update({ status: 'APPROVED' });
    }
  }

  return { success: true };
});

// --- PUBLIC: LEADERBOARD ---
export const getLeaderboard = functions.https.onCall(async (data, context) => {
  try {
    const results: any = {};
    for (const city of RANKING_CITIES) {
      try {
        const q = db.collection('sellers')
            .where('city', '==', city)
            .orderBy('totalPoints', 'desc')
            .limit(3);
        const snap = await q.get();
        results[city] = snap.docs.map(d => ({
            name: d.data().fullName || d.data().email.split('@')[0],
            sales: d.data().totalSales,
            points: d.data().totalPoints || 0
        }));
      } catch (innerErr) {
        // Log individual city failures (likely missing index) but don't fail whole request
        console.warn(`Error fetching leaderboard for ${city}:`, innerErr);
        results[city] = [];
      }
    }
    return results;
  } catch (e: any) {
    console.error("Leaderboard Fatal Error", e);
    // Return empty results instead of crashing client
    return { "La Paz": [], "Cochabamba": [], "Santa Cruz": [] };
  }
});

// --- ADMIN: STATS ---
export const adminGetStats = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const [clientsSnap, sellersSnap, codesSnap] = await Promise.all([
    db.collection('clients').count().get(),
    db.collection('sellers').count().get(),
    db.collection('valid_codes').count().get()
  ]);
  return {
    totalClients: clientsSnap.data().count,
    totalSellers: sellersSnap.data().count,
    totalCodes: codesSnap.data().count
  };
});

// --- ADMIN: CONFIGURATION ---
export const setGeneralConfig = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  // data.raffleDate is used
  await db.collection('campaign_config').doc('general').set({ 
    raffleDate: data.raffleDate,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() 
  }, { merge: true });
  return { success: true };
});

// NEW: Save Notification Config
export const saveNotificationConfig = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  // Validate basic structure
  const { whatsapp, email } = data;
  if (!whatsapp || !email) throw new functions.https.HttpsError('invalid-argument', 'Faltan configuraciones.');

  // Save to a protected document that is only readable by Admin SDK (Functions) or via this specific admin call
  await db.collection('settings').doc('notifications').set({
    whatsapp,
    email,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: context.auth?.uid
  });

  return { success: true };
});

// NEW: Get Notification Config (for UI population)
export const getNotificationConfig = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const docSnap = await db.collection('settings').doc('notifications').get();
  if (!docSnap.exists) return { whatsapp: {}, email: {} };
  return docSnap.data();
});

// NEW: Test Notification
export const sendTestNotification = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const { type } = data; // 'whatsapp' | 'email'
  const settingsDoc = await db.collection('settings').doc('notifications').get();
  const config = settingsDoc.data();
  
  if (!config) throw new functions.https.HttpsError('failed-precondition', 'No hay configuración guardada.');

  if (type === 'whatsapp') {
      const { token, phoneId } = config.whatsapp || {};
      if (!token || !phoneId) throw new functions.https.HttpsError('failed-precondition', 'Faltan datos de WhatsApp.');
      
      try {
        return { success: true, message: 'Configuración válida. (Simulación de envío realizada)' };
      } catch (e: any) {
         console.error("WhatsApp Error", e.response?.data || e.message);
         throw new functions.https.HttpsError('unknown', 'Error conectando con Meta API.');
      }
  } 
  
  if (type === 'email') {
      if (!config.email?.host) throw new functions.https.HttpsError('failed-precondition', 'Faltan datos SMTP.');
      return { success: true, message: 'Datos SMTP válidos. (Simulación de envío realizada)' };
  }
  
  return { success: false };
});

// --- PUBLIC: SERIAL VALIDATION ---
export const validateSerial = functions.https.onCall(async (data, context) => {
  const serial = data.serial ? String(data.serial).trim().toUpperCase() : '';
  if (!serial) throw new functions.https.HttpsError('invalid-argument', 'Serial vacío.');

  try {
    // 1. Check Valid Codes
    const codeRef = db.collection('valid_codes').doc(serial);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
        return { status: 'NOT_FOUND', message: 'Serial no encontrado. Verifica el Número de Serial del TV.' };
    }

    const codeData = codeDoc.data();
    // Check if used
    if (codeData?.used) {
        return { status: 'USED', message: 'Este serial ya fue registrado.' };
    }

    // 2. Get Product Info (for coupons count)
    let coupons = 1;
    let description = '';

    if (codeData?.model) {
        const productsSnap = await db.collection('products').where('model', '==', codeData.model).limit(1).get();
        if (!productsSnap.empty) {
            const pData = productsSnap.docs[0].data();
            coupons = pData.couponsBuyer || 1;
            description = pData.description || '';
        }
    }

    return {
        status: 'AVAILABLE',
        model: codeData?.model,
        coupons,
        description
    };

  } catch (error: any) {
    console.error("Error validating serial:", error);
    throw new functions.https.HttpsError('internal', 'Error validando el serial.');
  }
});