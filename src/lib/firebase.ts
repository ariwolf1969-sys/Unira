'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDE1GOSjZskt8LtGIFPh26bEBIPgJl6ASI",
  authDomain: "cooperativa-unira.firebaseapp.com",
  projectId: "cooperativa-unira",
  storageBucket: "cooperativa-unira.firebasestorage.app",
  messagingSenderId: "408829290850",
  appId: "1:408829290850:web:0a22a47d55ed4f6877e43b"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
