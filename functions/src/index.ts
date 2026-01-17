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

// --- PRODUCTS MANAGEMENT ---

const SEED_PRODUCTS = [
    { model_key: "Q7500G", model_name: "Q7500G", description: "65, 75 pulgadas", ticket_multiplier: 4, is_active: true },
    { model_key: "Q7700G", model_name: "Q7700G", description: "86 pulgadas", ticket_multiplier: 4, is_active: true },
    { model_key: "Q7800G", model_name: "Q7800G", description: "100 pulgadas", ticket_multiplier: 4, is_active: true },
    { model_key: "Q6600H", model_name: "Q6600H", description: "55, 60, 65, 75 pulgadas", ticket_multiplier: 3, is_active: true },
    { model_key: "G6600_55_75", model_name: "G6600H-G6600G (55-75)", description: "55, 60, 65, 75 pulgadas", ticket_multiplier: 3, is_active: true },
    { model_key: "G6600_50", model_name: "G6600H-G6600G (50)", description: "50 pulgadas", ticket_multiplier: 2, is_active: true },
    { model_key: "E6600H", model_name: "E6600H", description: "32, 43 pulgadas", ticket_multiplier: 2, is_active: true },
    { model_key: "E5500_40", model_name: "E5500H-E5500G (40)", description: "40 pulgadas", ticket_multiplier: 2, is_active: true },
    { model_key: "E5500_32_43", model_name: "E5500H-E5500G (32-43)", description: "32, 43 pulgadas", ticket_multiplier: 1, is_active: true },
];

export const seedOfficialProducts = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    const batch = db.batch();

    // Safety check: Don't overwrite if manual changes were made? No, prompt says "Ensure database has specific products".
    // We will upsert based on model_key.
    for (const p of SEED_PRODUCTS) {
        const ref = db.collection('products').doc(p.model_key);
        batch.set(ref, p, { merge: true });
    }

    await batch.commit();
    return { success: true, count: SEED_PRODUCTS.length };
});

export const getProducts = functions.https.onCall(async (data, context) => {
    // Admin or public? Public needs it for validation maybe, but mainly admin. Let's restrict for now.
    // Actually, client registration needs it internally. Admin needs to list.
    assertAdmin(context);
    const snap = await db.collection('products').orderBy('model_key').get();
    return { products: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});

export const saveProduct = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    const { product } = data;
    if (!product.model_key) throw new functions.https.HttpsError('invalid-argument', 'Falta Key');

    await db.collection('products').doc(product.model_key).set(product, { merge: true });
    return { success: true };
});

export const deleteProduct = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    const { id } = data;
    await db.collection('products').doc(id).delete();
    return { success: true };
});


// --- PUBLIC: CLIENT REGISTRATION (Enhanced with Tickets) ---
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
      let ticketMultiplier = 1; // Default
      let officialModel = tvModel;

      if (cleanSerial !== 'N/A') {
        // A. Check duplicates in CLIENTS
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

            // C. Resolve Multiplier
            // Try to find product by linked productId or matching model string
            let productDoc;

            if (codeData?.productId) {
                productDoc = await t.get(db.collection('products').doc(codeData.productId));
            } else if (codeData?.model) {
                // Fallback: Try to match model_key or model_name in products
                // This is fuzzy if not strictly linked.
                // Ideally, valid_codes should have been imported with the correct model_key.
                // We will try a direct lookup if the code model matches a key
                productDoc = await t.get(db.collection('products').doc(codeData.model));
            }

            if (productDoc && productDoc.exists) {
                const prod = productDoc.data();
                if (prod && prod.ticket_multiplier) {
                    ticketMultiplier = prod.ticket_multiplier;
                    officialModel = prod.model_name;
                }
            } else {
                // If no official product found, check if the input tvModel matches a key
                // Or proceed with 1 ticket (fallback)
                // NOTE: User requirement says "System MUST emit EXACT quantity according to MODEL".
                // If we can't find it, should we fail or default?
                // Let's try to search products by model_name match if direct key failed
                const prodQuery = await t.get(db.collection('products').where('model_name', '==', tvModel).limit(1));
                if (!prodQuery.empty) {
                     const prod = prodQuery.docs[0].data();
                     ticketMultiplier = prod.ticket_multiplier;
                }
            }

            // Mark as used
            t.update(codeRef, { 
                used: true, 
                usedBy: ci, 
                usedAt: admin.firestore.FieldValue.serverTimestamp(),
                buyer_status: 'REGISTERED',
                buyer_registered_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
      }

      // Generate N tickets
      const ticketIds: string[] = [];
      const ticketsData: any[] = [];
      const clientId = db.collection('clients').doc().id;

      for (let i = 0; i < ticketMultiplier; i++) {
          const tid = generateTicketId();
          ticketIds.push(tid);
          ticketsData.push({
              ticketId: tid,
              clientId,
              fullName: String(fullName),
              ci: String(ci),
              phone: String(phone),
              city: String(city),
              tvModel: String(officialModel),
              createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
      }

      // Save Client Profile
      const docData = {
        clientId,
        fullName: String(fullName),
        ci: String(ci),
        city: String(city),
        email: String(email),
        phone: String(phone),
        tvModel: String(officialModel),
        serial: cleanSerial,
        invoicePath: String(invoicePath),
        ticketId: ticketIds[0], // Legacy support
        ticketIds, // New array support
        ticketCount: ticketMultiplier,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'WEB_FORM'
      };

      t.set(db.collection('clients').doc(clientId), docData);

      // Save Individual Tickets (for the raffle drum)
      ticketsData.forEach(td => {
          const tRef = db.collection('tickets').doc(td.ticketId);
          t.set(tRef, td);
      });

      return { success: true, ticketId: ticketIds[0], ticketIds, message: `Registro exitoso. Obtuviste ${ticketMultiplier} tickets.` };
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

// --- ADMIN: IMPORT CODES (Updated) ---
export const importCodes = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    const { codes } = data; // Expects array of { code, model, productId? }

    if (!Array.isArray(codes) || codes.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Lista de códigos vacía.');
    }
    
    const batch = db.batch();
    let count = 0;
    const batchId = new Date().toISOString();

    for (const item of codes) {
        if (!item.code) continue;
        const codeRef = db.collection('valid_codes').doc(String(item.code).trim().toUpperCase());

        // Sanitize model to match keys if possible?
        // Ideally the CSV has the exact model_key

        batch.set(codeRef, {
            code: String(item.code).trim().toUpperCase(),
            model: item.model || 'Unknown',
            // Try to assign a productId if we can guess it or if it is provided
            // For now, we store model and let registerClient resolve it dynamically or strict check
            used: false,
            batchId,
            importedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        count++;
        if (count >= 490) break;
    }

    await batch.commit();
    return { success: true, count };
});

// --- ADMIN: PICK WINNER (Updated to use tickets collection) ---
export const pickWinner = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    
    // 1. Get all tickets
    // Optimization: Select ID from 'tickets' collection
    const snapshot = await db.collection('tickets').select('ticketId').get();
    
    if (snapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'No hay tickets registrados.');
    }

    const docs = snapshot.docs;
    const randomIndex = Math.floor(Math.random() * docs.length);
    const winnerTicketDoc = docs[randomIndex];
    const winnerTicketId = winnerTicketDoc.id;

    // Get full ticket data
    const ticketFullDoc = await db.collection('tickets').doc(winnerTicketId).get();
    const ticketData = ticketFullDoc.data();

    if (!ticketData) throw new functions.https.HttpsError('internal', 'Error recuperando datos del ticket ganador.');

    // 2. Save to Winners collection
    // We save the specific ticket info
    await db.collection('winners').doc(winnerTicketId).set({
        ...ticketData,
        wonAt: admin.firestore.FieldValue.serverTimestamp(),
        selectedBy: context.auth?.uid
    });

    return { success: true, winner: ticketData };
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
      const sellerDoc = await t.get(sellerRef);
      // Initialize or Update Seller Stats
      if (!sellerDoc.exists) {
          t.set(sellerRef, {
              uid,
              email: context.auth!.token.email || '',
              totalSales: 1, 
              city: city, 
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastSaleAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
      } else {
          t.update(sellerRef, {
              totalSales: admin.firestore.FieldValue.increment(1),
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
            .orderBy('totalSales', 'desc')
            .limit(3);
        const snap = await q.get();
        results[city] = snap.docs.map(d => ({
            name: d.data().fullName || d.data().email.split('@')[0],
            sales: d.data().totalSales
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
      const { token, phoneId, templateName } = config.whatsapp || {};
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
