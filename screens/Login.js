import { StyleSheet, TextInput, View, Text, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const AuthScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async () => {
        if (!email.trim() || !password) {
            setErrorMessage("Email et mot de passe requis.");
            return;
        }
        setIsLoading(true);
        setErrorMessage('');
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email.trim(), password);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            }
        } catch (error) {
            const messages = {
                'auth/invalid-email': "Adresse email invalide.",
                'auth/user-not-found': "Aucun compte avec cet email.",
                'auth/wrong-password': "Mot de passe incorrect.",
                'auth/email-already-in-use': "Cet email est déjà utilisé.",
                'auth/weak-password': "Mot de passe trop faible (6 caractères minimum).",
                'auth/invalid-credential': "Email ou mot de passe incorrect.",
            };
            setErrorMessage(messages[error.code] || "Une erreur s'est produite. Réessayez.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.card}>
                <Text style={styles.appTitle}>Todoux MoSCoW</Text>
                <Text style={styles.title}>{isSignUp ? 'Créer un compte' : 'Connexion'}</Text>

                <TextInput
                    placeholder='Email'
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize='none'
                    keyboardType="email-address"
                    style={styles.input}
                />
                <TextInput
                    placeholder='Mot de passe'
                    placeholderTextColor="#999"
                    value={password}
                    autoCapitalize='none'
                    onChangeText={setPassword}
                    style={styles.input}
                    secureTextEntry
                    onSubmitEditing={handleAuth}
                    returnKeyType="done"
                />

                {errorMessage ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    onPress={handleAuth}
                    disabled={isLoading}
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                >
                    {isLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>{isSignUp ? 'Créer mon compte' : 'Se connecter'}</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setErrorMessage(''); }} style={styles.toggleRow}>
                    <Text style={styles.toggleText}>
                        {isSignUp ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
                        <Text style={styles.toggleLink}>{isSignUp ? 'Se connecter' : "S'inscrire"}</Text>
                    </Text>
                </TouchableOpacity>
            </View>
            <StatusBar style="auto" />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7', padding: 20 },
    card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 28, elevation: 4 },
    appTitle: { fontSize: 22, fontWeight: '800', color: '#007AFF', textAlign: 'center', marginBottom: 4 },
    title: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 24 },
    input: { backgroundColor: '#F2F2F7', padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 15, color: '#000' },
    errorBox: { backgroundColor: '#FFF2F2', borderRadius: 10, padding: 10, marginBottom: 12 },
    errorText: { color: '#FF3B30', fontSize: 13, textAlign: 'center' },
    button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 4 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    toggleRow: { marginTop: 20, alignItems: 'center' },
    toggleText: { fontSize: 14, color: '#8E8E93' },
    toggleLink: { color: '#007AFF', fontWeight: '600' }
});

export default AuthScreen;
