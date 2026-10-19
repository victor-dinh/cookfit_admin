import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  projectId: 'cookfit-94659',
  appId: '1:913307816637:web:ded02d9131bf1187025dd4',
  storageBucket: 'cookfit-94659.firebasestorage.app',
  apiKey: 'AIzaSyBcD3AS6wtEv7S6X4BfuAO_cJdlqd29bv0',
  authDomain: 'cookfit-94659.firebaseapp.com',
  messagingSenderId: '913307816637',
  measurementId: 'G-PHQ4FFKE2L',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
