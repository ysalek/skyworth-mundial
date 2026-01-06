import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

// Interfaces
interface RegistrationData {
  firstName: string;
  lastName: string;
  ci: string;
  email: string;
  phone: string;
  city: string;
  code: string;
  campaignType: string;
  filePaths: {
    ciFrontPath: string;
    ciBackPath: string;
    invoicePath?: string;
  };
}

// Helpers
const hashCI = (ci: string) => {
    if (!ci || typeof ci !== 'string') return 'INVALID_CI';
    return crypto.createHash('sha256').update(ci.trim().toLowerCase()).digest('hex');
}

const assertAdmin = (context: functions.https.CallableContext) => {
  const SUPER_ADMIN = 'LTNwDZDCH6cZwqhVH7Ol1guYBuJ2';
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión');
  
  const isAdminClaim = context.auth.token.admin === true;
  const isSuperAdminUid = context.auth.uid === SUPER_ADMIN;

  if (!isAdminClaim && !isSuperAdminUid) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores autorizados');
  }
};

// --- SERVICIOS DE NOTIFICACIÓN ---

interface ServiceResult { success: boolean; error?: string; }

const triggerWebhook = async (url: string, data: any): Promise<ServiceResult> => {
  if (!url) return { success: false, error: 'No URL configured' };
  try {
    await axios.post(url, {
      event: "new_registration",
      ...data,
      tickets_list: data.tickets.join(", "),
      timestamp: new Date().toISOString()
    });
    return { success: true };
  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return { success: false, error: error.message };
  }
};

const sendEmail = async (config: any, to: string, name: string, tickets: string[], tvCode: string): Promise<ServiceResult> => {
  if (!config || !config.apiKey) return { success: false, error: 'No API Key' };
  
  const htmlContent = `
    <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f4; padding: 20px;">
      <div style="background: linear-gradient(135deg, #001A3D 0%, #005BBB 100%); padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #FFD700; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">¡YA ESTÁS EN LA CANCHA!</h1>
        <p style="color: #ffffff; font-size: 16px; margin-top: 10px;">Hola <strong>${name}</strong>, tu registro ha sido validado.</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <p style="color: #333; font-size: 16px; line-height: 1.5; text-align: center;">
          Gracias por registrar tu TV Skyworth (Modelo: <strong>${tvCode}</strong>).<br>
          Aquí tienes tus <strong>Tickets Dorados</strong> para el gran sorteo final:
        </p>
        
        <div style="margin: 30px 0;">
          ${tickets.map(t => `
            <div style="background-color: #f8f9fa; border: 2px dashed #FFD700; border-radius: 8px; padding: 15px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 24px; margin-right: 15px;">🎟️</span>
              <span style="font-size: 20px; font-weight: bold; color: #002F6C; letter-spacing: 1px;">${t}</span>
            </div>
          `).join('')}
        </div>
        
        <div style="text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="color: #666; font-size: 14px;">Mucha suerte en el sorteo.</p>
          <p style="color: #005BBB; font-weight: bold;">SKYWORTH MUNDIAL 2025</p>
        </div>
      </div>
    </div>
  `;

  try {
    await axios.post('https://api.sendgrid.com/v3/mail/send', {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.fromEmail, name: "Skyworth Promo" },
      subject: "🎟️ Confirmación de Jugada: Tus Tickets Skyworth",
      content: [{ type: "text/html", value: htmlContent }]
    }, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    return { success: true };
  } catch (error: any) {
    console.error("Email Error:", error.response?.data || error.message);
    return { success: false, error: "SendGrid Error" };
  }
};

const sendWhatsApp = async (config: any, phone: string, name: string, tickets: string[], tvCode: string): Promise<ServiceResult> => {
  if (!config || !config.accessToken || !config.phoneNumberId) return { success: false, error: 'No WhatsApp Config' };

  const ticketList = tickets.map(t => `🎟 *${t}*`).join('\n');

  try {
    await axios.post(`https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone.replace('+', '').trim(),
      type: "text",
      text: {
        body: `⚽ *¡GOLAZO ${name.toUpperCase()}!* ⚽\n\nTu registro del TV *${tvCode}* fue exitoso. Ya estás participando en el sorteo.\n\n👇 *TUS TICKETS DORADOS:*\n\n${ticketList}\n\n🏆 ¡Mucha suerte!\n_Skyworth Mundial 2025_`
      }
    }, {
      headers: { 
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return { success: true };
  } catch (error: any) {
    console.error("WhatsApp Error:", error.response?.data || error.message);
    return { success: false, error: "Meta API Error" };
  }
};

const processNotification = async (participantData: any, docRef: admin.firestore.DocumentReference, ticketCodes: string[]) => {
  if (!ticketCodes || ticketCodes.length === 0) return;

  const [emailConfigSnap, waConfigSnap, webhookConfigSnap] = await Promise.all([
    db.collection('settings').doc('email').get(),
    db.collection('settings').doc('whatsapp').get(),
    db.collection('settings').doc('webhook').get()
  ]);

  const emailConfig = emailConfigSnap.data();
  const waConfig = waConfigSnap.data();
  const webhookConfig = webhookConfigSnap.data();

  const webhookPayload = {
    first_name: participantData.firstName,
    full_name: participantData.fullName,
    email: participantData.email,
    phone: participantData.phone,
    tv_code: participantData.code,
    tickets: ticketCodes,
    tickets_count: ticketCodes.length,
    city: participantData.city,
    campaign_type: participantData.campaignType
  };
  
  console.log(`Notifying ${participantData.email}...`);

  const results = await Promise.allSettled([
    sendEmail(emailConfig, participantData.email, participantData.firstName, ticketCodes, participantData.code),
    sendWhatsApp(waConfig, participantData.phone, participantData.firstName, ticketCodes, participantData.code),
    triggerWebhook(webhookConfig?.url, webhookPayload)
  ]);

  const emailRes = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Promise Failed' };
  const waRes = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: 'Promise Failed' };
  const webhookRes = results[2].status === 'fulfilled' ? results[2].value : { success: false, error: 'Promise Failed' };

  await docRef.update({
    'notified.email': emailRes.success,
    'notified.whatsapp': waRes.success,
    'notified.webhook': webhookRes.success,
    'notified.lastAttempt': admin.firestore.FieldValue.serverTimestamp(),
    'notified.errors': {
       email: emailRes.error || null,
       whatsapp: waRes.error || null,
       webhook: webhookRes.error || null
    }
  });
};

// --- CORE HELPER PARA REGISTRO ---
const registerCore = async (data: RegistrationData, isAdminOverride = false) => {
  const { code, ci, firstName, lastName, email, phone, campaignType, filePaths } = data;
  const ciHash = hashCI(ci);

  return db.runTransaction(async (transaction) => {
    // 1. Validar Código
    const codeRef = db.collection('tv_codes').doc(code);
    const codeDoc = await transaction.get(codeRef);

    if (!codeDoc.exists) throw new functions.https.HttpsError('not-found', `El código ${code} no existe en la base de datos.`);
    const codeData = codeDoc.data()!;
    if (!codeData.active) throw new functions.https.HttpsError('failed-precondition', 'El código está inactivo.');
    if (codeData.used) throw new functions.https.HttpsError('already-exists', 'El código ya fue registrado previamente.');

    // 2. Generar Tickets
    const multiplier = codeData.ticketMultiplier || 1;
    const newTickets: string[] = [];
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    for (let i = 0; i < multiplier; i++) {
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const ticketCode = `SKY-2025-${randomSuffix}`;
      newTickets.push(ticketCode);
    }

    // 3. Crear Participante
    const participantId = db.collection('participants').doc().id;
    const participantRef = db.collection('participants').doc(participantId);

    const newParticipantData = {
      participantId,
      campaignType,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      ci: isAdminOverride ? `ADMIN_ENTRY_${ci}` : 'RESTRICTED', // Si es admin, guardamos ref visible
      ciHash,
      email,
      phone,
      code,
      tvModel: codeData.tvModel || 'Generic', // Guardamos el modelo para analítica rápida
      files: filePaths,
      ticketsCount: multiplier,
      notified: { email: false, whatsapp: false, webhook: false },
      source: isAdminOverride ? 'ADMIN_PANEL' : 'PUBLIC_WEB',
      createdAt: timestamp
    };

    transaction.set(participantRef, newParticipantData);

    // 4. Crear Tickets
    newTickets.forEach(tCode => {
      const ticketRef = db.collection('tickets').doc(tCode);
      transaction.set(ticketRef, {
        ticketId: tCode,
        codeString: tCode,
        participantId,
        tvCode: code,
        inches: codeData.inches,
        campaignType,
        createdAt: timestamp
      });
    });

    // 5. Marcar código
    transaction.update(codeRef, {
      used: true,
      usedByParticipantId: participantId,
      updatedAt: timestamp
    });

    return { success: true, tickets: newTickets, message: 'Registro exitoso', participantId };
  });
};


// --- FUNCIONES PÚBLICAS ---

export const createRegistration = functions.https.onCall(async (data: RegistrationData, context) => {
  if (!data.code || !data.ci || !data.email) throw new functions.https.HttpsError('invalid-argument', 'Faltan datos obligatorios');
  
  const result = await registerCore(data, false);
  
  // Trigger notificaciones asíncrono
  try {
    const pDoc = await db.collection('participants').doc(result.participantId).get();
    if(pDoc.exists) await processNotification(pDoc.data(), pDoc.ref, result.tickets);
  } catch(e) { console.error("Error notification", e); }
  
  return result;
});

export const checkMyTickets = functions.https.onCall(async (data, context) => {
  const { email } = data;
  if (!email) throw new functions.https.HttpsError('invalid-argument', 'Email requerido');

  const snapshot = await db.collection('participants')
    .where('email', '==', email)
    .orderBy('createdAt', 'desc')
    .get();

  if (snapshot.empty) return { found: false, message: "No encontramos registros con este email." };

  const results: any[] = [];
  for (const doc of snapshot.docs) {
    const pData = doc.data();
    const tSnap = await db.collection('tickets').where('participantId', '==', pData.participantId).get();
    const codes = tSnap.docs.map(t => t.data().codeString);
    results.push({
      date: pData.createdAt.toDate().toISOString(),
      tvCode: pData.code,
      tickets: codes
    });
  }
  return { found: true, history: results };
});

// --- FUNCIONES ADMIN ---

// Analytics Report
export const getCampaignAnalytics = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  
  // Nota: Para grandes volúmenes, usar agregaciones o scheduled functions.
  // Para < 50k registros, leer los documentos seleccionando pocos campos es viable.
  const snapshot = await db.collection('participants').select('city', 'tvModel').get();
  
  const cityCount: Record<string, number> = {};
  const modelCount: Record<string, number> = {};
  
  snapshot.forEach(doc => {
    const d = doc.data();
    // Normalizar ciudad
    const city = (d.city || 'Desconocido').toUpperCase().trim();
    const model = (d.tvModel || 'Generic').toUpperCase().trim();
    
    cityCount[city] = (cityCount[city] || 0) + 1;
    modelCount[model] = (modelCount[model] || 0) + 1;
  });
  
  return { cityCount, modelCount };
});

export const adminGetCodes = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const { pageSize = 20, lastCode, filter, search } = data;
  
  let q = db.collection('tv_codes').orderBy('code');

  if (search) {
      const term = search.trim().toUpperCase();
      q = q.where('code', '>=', term).where('code', '<=', term + '\uf8ff');
  } else {
       if (filter === 'USED') q = q.where('used', '==', true);
       if (filter === 'AVAILABLE') q = q.where('used', '==', false);
  }

  if (lastCode) {
      const docSnap = await db.collection('tv_codes').doc(lastCode).get();
      if(docSnap.exists) q = q.startAfter(docSnap);
  }

  const snapshot = await q.limit(pageSize).get();
  return {
      codes: snapshot.docs.map(d => d.data()),
      lastCode: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null
  };
});

// Admin Manual Registration (Sin subir archivos, ideal para POS o soporte)
export const adminManualRegistration = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const { code, ci, firstName, lastName, email, phone, campaignType } = data;
  
  const manualData: RegistrationData = {
      code: code ? code.toUpperCase() : 'UNKNOWN',
      ci,
      firstName,
      lastName,
      email,
      phone,
      campaignType: campaignType || 'EXISTING',
      city: 'ADMIN_REGISTER',
      filePaths: { ciFrontPath: 'MANUAL', ciBackPath: 'MANUAL' }
  };

  const result = await registerCore(manualData, true);
  
  try {
    const pDoc = await db.collection('participants').doc(result.participantId).get();
    if(pDoc.exists) await processNotification(pDoc.data(), pDoc.ref, result.tickets);
  } catch(e) { console.error("Error notification admin manual", e); }
  
  return result;
});

export const adminUploadCodes = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const csvContent: string = data.csvContent;
  const lines = csvContent.split('\n');
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (let i = 1; i < lines.length; i++) { 
    const line = lines[i].trim();
    if (!line) continue;
    const [code, tvModel, inchesStr, ticketMultiplierStr] = line.split(',');
    
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      const inches = parseInt(inchesStr) || 32;
      let multiplier = parseInt(ticketMultiplierStr);

      if (isNaN(multiplier) || multiplier < 1) {
          if (inches >= 65) multiplier = 3;
          else if (inches >= 50) multiplier = 2;
          else multiplier = 1;
      }

      batch.set(db.collection('tv_codes').doc(cleanCode), {
        code: cleanCode,
        tvModel: tvModel?.trim() || 'Generic',
        inches: inches,
        ticketMultiplier: multiplier,
        active: true,
        used: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
      batchCount++;
      if (batchCount >= 450) { await batch.commit(); batch = db.batch(); batchCount = 0; }
    }
  }
  if (batchCount > 0) await batch.commit();
  return { message: `Procesados ${count} códigos.` };
});

export const seedTestCodes = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const batch = db.batch();
  const testCodes = [
    { code: 'TEST-32-001', tvModel: '32STD6500', inches: 32, ticketMultiplier: 1 },
    { code: 'TEST-50-001', tvModel: '50SUE9350', inches: 50, ticketMultiplier: 2 },
    { code: 'TEST-55-001', tvModel: '55SUE9500', inches: 55, ticketMultiplier: 2 },
    { code: 'TEST-65-001', tvModel: '65SUE9500', inches: 65, ticketMultiplier: 3 },
  ];
  let count = 0;
  for (const item of testCodes) {
    const ref = db.collection('tv_codes').doc(item.code);
    if (!(await ref.get()).exists) {
      batch.set(ref, { ...item, active: true, used: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      count++;
    }
  }
  if (count > 0) await batch.commit();
  return { message: `Generados ${count} códigos de prueba.` };
});

export const getSystemHealth = functions.https.onCall(async (data, context) => {
    assertAdmin(context);
    const [wa, em, wh] = await Promise.all([
        db.collection('settings').doc('whatsapp').get(),
        db.collection('settings').doc('email').get(),
        db.collection('settings').doc('webhook').get()
    ]);
    return {
        whatsapp: !!wa.data()?.accessToken,
        email: !!em.data()?.apiKey,
        webhook: !!wh.data()?.url
    };
});

export const setWhatsappConfig = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  await db.collection('settings').doc('whatsapp').set({ phoneNumberId: data.phoneNumberId, accessToken: data.accessToken, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});

export const setEmailConfig = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  await db.collection('settings').doc('email').set({ provider: data.provider, apiKey: data.apiKey, fromEmail: data.fromEmail, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});

export const setWebhookConfig = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  await db.collection('settings').doc('webhook').set({ 
    url: data.webhookUrl, 
    provider: data.provider || 'Generic', 
    updatedAt: admin.firestore.FieldValue.serverTimestamp() 
  });
  return { success: true };
});

export const setGeneralConfig = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  // data.raffleDate should be an ISO string or timestamp
  await db.collection('settings').doc('general').set({ 
    raffleDate: data.raffleDate,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() 
  }, { merge: true });
  return { success: true };
});

export const retryNotification = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const doc = await db.collection('participants').doc(data.participantId).get();
  if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Participante no encontrado');
  
  const ticketsSnap = await db.collection('tickets').where('participantId', '==', data.participantId).get();
  const ticketCodes = ticketsSnap.docs.map(t => t.data().codeString);
  
  await processNotification(doc.data(), doc.ref, ticketCodes);
  return { success: true };
});

export const pickWinner = functions.https.onCall(async (data, context) => {
  assertAdmin(context);
  const snapshot = await db.collection('tickets').count().get();
  const total = snapshot.data().count;
  if (total === 0) throw new functions.https.HttpsError('failed-precondition', 'No hay tickets.');
  
  const randomIndex = Math.floor(Math.random() * total);
  const winnerSnap = await db.collection('tickets').orderBy('createdAt').limit(1).offset(randomIndex).get();
  if (winnerSnap.empty) throw new functions.https.HttpsError('internal', 'Error al obtener ticket.');

  const ticketData = winnerSnap.docs[0].data();
  const partSnap = await db.collection('participants').doc(ticketData.participantId).get();

  return { ticket: ticketData, participant: partSnap.exists ? partSnap.data() : null };
});