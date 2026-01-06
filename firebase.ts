import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Configuración provista por el usuario
const firebaseConfig = {
  apiKey: "AIzaSyBxUVBsiPe5pVTRVN0B54Pq2NO3aESn9n8",
  authDomain: "skyworth-d0e47.firebaseapp.com",
  projectId: "skyworth-d0e47",
  storageBucket: "skyworth-d0e47.firebasestorage.app",
  messagingSenderId: "174132997592",
  appId: "1:174132997592:web:53f1136544597e325396ad"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Helper para subir archivos a ruta temporal (segura por reglas de Storage)
export const uploadFile = async (file: File, folder: string): Promise<string> => {
  // 1. Validaciones Cliente
  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`El archivo "${file.name}" es muy pesado. Máximo ${MAX_SIZE_MB}MB.`);
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`El formato de "${file.name}" no es válido. Solo Imágenes o PDF.`);
  }

  // 2. Subida
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  // Subimos a una carpeta "uploads" que tiene reglas write-only para public
  const path = `uploads/${folder}/${uniqueName}`;
  const storageRef = ref(storage, path);
  
  await uploadBytes(storageRef, file);
  return path; // Retornamos el PATH, no la URL pública (seguridad)
};