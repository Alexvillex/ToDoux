import { Image } from 'expo-image';
import { View, StyleSheet, Text, ScrollView, SafeAreaView } from 'react-native';
import HomeScreen from '../../screens/Homepage.js';
import AuthScreen from '../../screens/Login.js';
import { auth } from '@/firebaseConfig.js';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

export default function AppIndex() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (Currentuser) => {
      setUser(Currentuser);
    });
    return unsubscribe;
  }, []);


  if (user) {
    return <HomeScreen />;
  } else {
    return <AuthScreen />;
  }
}

