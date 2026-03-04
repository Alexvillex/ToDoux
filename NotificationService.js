import { Platform } from 'react-native';

let notification = null;
let Device = null;



if (Platform.OS === 'web') {
    console.log('Notifications désactivées sur cette plateforme.')}
else{
    
    notification = require('expo-notifications');
    Device = require('expo-device');
    notification.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
        }),
    });
}

export const registerForPushNotificationsAsync = async () => {
    if(Platform.OS === 'web'){
        return null;
    }else{
        if (Device.isDevice) {
            const { status: existingStatus } = await notification.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await notification.requestPermissionsAsync();
                finalStatus = status;
            }
                return finalStatus;
        }else{
            return 'Must use physical device for Push Notifications';
        }
    }
}

export const schedulePushNotification = async (title, date) => {
    if (Platform.OS === 'web') {
        return null;
    }

    // Étape B : On prépare le trigger
    const trigger = new Date(date);


    if (isNaN(trigger.getTime()) || trigger <= new Date()) {
        console.log("Date invalide ou déjà passée");
        return null; 
    }

    return await notification.scheduleNotificationAsync({
        content: {
            title: "Todoux : Rappel 🦾",
            body: `C'est l'heure de : ${title}`,
            sound: true,
        },
        trigger: trigger,
    });
}