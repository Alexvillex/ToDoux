import { Platform } from 'react-native';

let notification = null;
let Device = null;

// Initialisation conditionnelle pour éviter les erreurs sur Web
if (Platform.OS === 'web') {
    console.log('Notifications désactivées sur cette plateforme.');
} else {
    // Import dynamique pour le mobile uniquement
    notification = require('expo-notifications');
    Device = require('expo-device');

    // Configuration de la gestion des notifs quand l'app est au premier plan
    notification.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

/**
 * Demande les permissions pour les notifications locales.
 * Note : On ne demande plus de PushToken pour rester compatible avec Expo Go (SDK 53+).
 */
export const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'web') {
        return null;
    }

    try {
        if (Device.isDevice) {
            const { status: existingStatus } = await notification.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await notification.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Permission de notification refusée.');
                return null;
            }

            return finalStatus; // On retourne juste le statut "granted"
        } else {
            console.log('Les notifications nécessitent un appareil physique.');
            return null;
        }
    } catch (error) {
        console.error("Erreur lors de la demande de permissions :", error);
        return null;
    }
};

/**
 * Programme une notification locale à une date précise.
 */
export const schedulePushNotification = async (title, date) => {
    if (Platform.OS === 'web' || !notification) {
        return null;
    }

    const trigger = new Date(date);

    // Vérification de la validité de la date
    if (isNaN(trigger.getTime()) || trigger <= new Date()) {
        console.log("Date invalide ou déjà passée, notification non programmée.");
        return null; 
    }

    try {
        return await notification.scheduleNotificationAsync({
            content: {
                title: "Todoux : Rappel 🦾",
                body: `C'est l'heure de : ${title}`,
                sound: true,
            },
            trigger: trigger,
        });
    } catch (error) {
        console.error("Erreur lors de la programmation de la notification :", error);
        return null;
    }
};