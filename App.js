import { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';
import HomeScreen from './screens/Homepage';
import AuthScreen from './screens/Login';

export default function App() {
    const [user, setUser] = useState(undefined);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return unsub;
    }, []);

    if (user === undefined) {
        return (
            <SafeAreaProvider>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' }}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            {user ? <HomeScreen user={user} /> : <AuthScreen />}
        </SafeAreaProvider>
    );
}
