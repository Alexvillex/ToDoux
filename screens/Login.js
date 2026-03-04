import { StatusBar } from 'expo-status-bar';
import { StyleSheet, TextInput, View, Button, Text, TouchableOpacity } from 'react-native';
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const AuthScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false); // Bascule entre Login et Register
    const [errorMessage, seterrorMessage] = useState('');

    const handleAuth = async () => {
        try {
            if (isSignUp) {
                // Inscription : crée un nouvel utilisateur
                await createUserWithEmailAndPassword(auth, email.trim(), password);
                console.log('Signed up');
            } else {
                // Connexion : vérifie les identifiants existants
                await signInWithEmailAndPassword(auth, email, password);
                console.log('Logged in');
            }
        } catch (error) {
            seterrorMessage(error.message);
            console.log("Erreur : "+ error.message)
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{isSignUp ? 'Inscription' : 'Connexion'}</Text>
            
            <TextInput 
                placeholder='Email'
                value={email}
                onChangeText={setEmail}
                autoCapitalize='none'
                style={styles.input}
            /> 
            <TextInput 
                placeholder='Password'
                value={password}
                autoCapitalize='none'
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry={true}
            />

            <Button 
                title={isSignUp ? 'Créer mon compte' : 'Se connecter'} 
                onPress={handleAuth} 
            />

            {/* Ce bouton permet de basculer entre les deux modes */}
            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{marginTop: 20}}>
                <Text style={{color: 'blue'}}>
                    {isSignUp ? 'Déjà un compte ? Connecte-toi' : 'Pas de compte ? Inscris-toi'}
                </Text>
            </TouchableOpacity>
            {errorMessage ? (
                <Text style={{ color: 'red', marginBottom: 10, textAlign: 'center' }}>
                    {errorMessage}
                </Text>
            ) : null}

            <StatusBar style="auto" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', backgroundColor: '#fff', alignItems: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    input: { width: '80%', maxWidth: 400, borderBottomWidth: 1, marginBottom: 20, padding: 10 }
});

export default AuthScreen;