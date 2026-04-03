import { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';
import HomeScreen from './screens/Homepage';
import AuthScreen from './screens/Login';

export default function App() {
    // undefined = chargement en cours, null = non connecté, objet = connecté
    const [user, setUser] = useState(undefined);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return unsub;
    }, []);

    if (user === undefined) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' }}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return user ? <HomeScreen user={user} /> : <AuthScreen />;
}
