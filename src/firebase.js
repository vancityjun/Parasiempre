// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const {
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MEASUREMENT_ID,
} = import.meta.env;
const firebaseConfig = {
  apiKey: VITE_FIREBASE_API_KEY,
  authDomain: "parasiempre-4fa62.firebaseapp.com",
  projectId: "parasiempre-4fa62",
  storageBucket: "parasiempre-4fa62.firebasestorage.app",
  messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: VITE_FIREBASE_APP_ID,
  measurementId: VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

if (import.meta.env.PROD) {
  import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((supported) => {
        if (supported) getAnalytics(app);
      }),
    )
    .catch((error) => {
      console.warn("Firebase Analytics is unavailable:", error);
    });
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIRESTORE_EMULATOR === "true"
) {
  connectFirestoreEmulator(db, "localhost", 8080);
}

if (
  import.meta.env.DEV &&
  (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" ||
    import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === "true")
) {
  connectFunctionsEmulator(functions, "localhost", 5001);
}
