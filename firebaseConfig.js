// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA5_1ijIBC6omExecpKdlm7BCVnVEoEZLw",
  authDomain: "todoux-fb858.firebaseapp.com",
  projectId: "todoux-fb858",
  storageBucket: "todoux-fb858.firebasestorage.app",
  messagingSenderId: "20887802003",
  appId: "1:20887802003:web:922ca8106e30c6f10c7d66"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const persistence = Platform.OS === 'web' 
  ? browserLocalPersistence 
  : getReactNativePersistence(AsyncStorage);

const auth = initializeAuth(app, {
  persistence : persistence,
});

const db = getFirestore(app);

export { auth, db };
