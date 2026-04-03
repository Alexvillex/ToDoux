import { Platform, StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, or } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import React, { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createFullTask, deleteFullTask, updateStatus, saveNotificationId } from '../src/service/taskService';
import { MOSCOW_CONFIG } from '../src/constants/moscow';
import { schedulePushNotification, cancelNotification, registerForPushNotificationsAsync } from '../src/service/NotificationService';

const webInputStyle = {
    borderWidth: 1, borderColor: '#D1D1D6', backgroundColor: '#fff',
    borderRadius: 8, padding: 8, color: '#007AFF', fontWeight: '600',
    fontSize: 14, marginTop: 5
};

export default function HomeScreen({ user }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [limite, setLimite] = useState(false);
    const [limiteDate, setLimiteDate] = useState(new Date());
    const [urgent, setUrgent] = useState(false);
    const [important, setImportant] = useState(false);
    const [reminder, setReminder] = useState(false);
    const [reminderDate, setReminderDate] = useState(new Date());
    const [inviteEmail, setInviteEmail] = useState('');
    const [showReminderPicker, setShowReminderPicker] = useState(false);
    const [showLimitePicker, setShowLimitePicker] = useState(false);
    const [reminderPickerStep, setReminderPickerStep] = useState('date');
    const [limitePickerStep, setLimitePickerStep] = useState('date');
    const [subTaskInput, setSubTaskInput] = useState('');
    const [tempSubTasks, setTempSubTasks] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [allSubTasks, setAllSubTasks] = useState([]);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            registerForPushNotificationsAsync().then((status) => {
                if (status === null) {
                    Alert.alert(
                        "Notifications désactivées",
                        "Activez les notifications dans les réglages pour recevoir vos rappels.",
                        [{ text: "OK" }]
                    );
                }
            });
        }

        const q = query(
            collection(db, "tasks"),
            or(where("user", "==", user.uid), where("collaborators", "array-contains", user.email))
        );

        const unsubTasks = onSnapshot(q, {
            next: (snapshot) => {
                const loaded = snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() }));
                setTasks(loaded.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
            },
            error: (error) => console.error("Erreur Tasks Snapshot:", error)
        });

        // Filtre sur l'utilisateur connecté uniquement (sécurité + performance)
        const unsubSubs = onSnapshot(
            query(collection(db, "subtasks"), where("user", "==", user.uid)),
            (snapshot) => setAllSubTasks(snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() })))
        );

        return () => { unsubTasks(); unsubSubs(); };
    }, [user]);

    const resetForm = () => {
        setTitle(''); setDescription(''); setInviteEmail(''); setTempSubTasks([]);
        setLimite(false); setUrgent(false); setImportant(false); setReminder(false);
    };

    const addSubTask = () => {
        if (subTaskInput.trim()) {
            setTempSubTasks([...tempSubTasks, subTaskInput.trim()]);
            setSubTaskInput('');
        }
    };

    const handleReminderChange = (event, selected) => {
        if (!selected || event.type === 'dismissed') {
            setShowReminderPicker(false);
            setReminderPickerStep('date');
            return;
        }
        if (Platform.OS === 'android') {
            if (reminderPickerStep === 'date') {
                const updated = new Date(reminderDate);
                updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                setReminderDate(updated);
                setReminderPickerStep('time');
            } else {
                const updated = new Date(reminderDate);
                updated.setHours(selected.getHours(), selected.getMinutes());
                setReminderDate(updated);
                setShowReminderPicker(false);
                setReminderPickerStep('date');
            }
        } else {
            setReminderDate(selected);
            setShowReminderPicker(false);
        }
    };

    const handleLimiteChange = (event, selected) => {
        if (!selected || event.type === 'dismissed') {
            setShowLimitePicker(false);
            setLimitePickerStep('date');
            return;
        }
        if (Platform.OS === 'android') {
            if (limitePickerStep === 'date') {
                const updated = new Date(limiteDate);
                updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                setLimiteDate(updated);
                setLimitePickerStep('time');
            } else {
                const updated = new Date(limiteDate);
                updated.setHours(selected.getHours(), selected.getMinutes());
                setLimiteDate(updated);
                setShowLimitePicker(false);
                setLimitePickerStep('date');
            }
        } else {
            setLimiteDate(selected);
            setShowLimitePicker(false);
        }
    };

    const removeSubTask = (index) => {
        setTempSubTasks(tempSubTasks.filter((_, i) => i !== index));
    };

    const addTask = async () => {
        if (!title.trim()) {
            Alert.alert("Champ requis", "Le titre est obligatoire.");
            return;
        }
        setIsCreating(true);
        try {
            const taskData = {
                title, description, inviteEmail,
                urgent, important,
                deadline: limite, deadlineDate: limite ? limiteDate : null,
                reminder, reminderDate: reminder ? reminderDate : null,
            };
            const result = await createFullTask(taskData, tempSubTasks);
            if (result.success) {
                if (reminder && reminderDate) {
                    const notifId = await schedulePushNotification(title, reminderDate);
                    if (notifId) {
                        await saveNotificationId(result.taskId, notifId);
                    } else if (Platform.OS !== 'web') {
                        Alert.alert("Rappel non programmé", "La date est déjà passée ou les notifications sont désactivées.");
                    }
                }
                resetForm();
            } else {
                Alert.alert("Erreur", "Impossible de créer la tâche. Veuillez réessayer.");
            }
        } catch (error) {
            Alert.alert("Erreur", "Une erreur inattendue s'est produite.");
            console.error(error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (taskId) => {
        // Annule la notification programmée si elle existe
        const taskToDelete = tasks.find(t => t.id === taskId);
        if (taskToDelete?.notificationId) {
            await cancelNotification(taskToDelete.notificationId);
        }
        const result = await deleteFullTask(taskId, allSubTasks);
        if (!result.success) {
            Alert.alert("Action refusée", "Vous n'avez pas les permissions pour supprimer cette tâche.");
        }
    };

    const renderCategory = (categoryKey, showCompletedOnly) => {
        const config = MOSCOW_CONFIG[categoryKey];
        const filteredTasks = tasks.filter(t =>
            (categoryKey === "All" ? true : t.category === categoryKey) && t.completed === showCompletedOnly
        );
        if (filteredTasks.length === 0) return null;

        return (
            <View key={categoryKey} style={[styles.card, { borderLeftColor: config.color }]}>
                <View style={styles.categoryHeader}>
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <Text style={styles.categoryTitle}>{config.label}</Text>
                </View>
                {filteredTasks.map((item) => {
                    const linkedSubs = allSubTasks.filter(st => st.parentId === item.id);
                    const done = linkedSubs.filter(st => st.completed).length;
                    const overdue = item.deadlineDate && new Date() > new Date(item.deadlineDate) && !item.completed;
                    return (
                        <View key={item.id} style={styles.taskContainer}>
                            <View style={styles.taskItem}>
                                <TouchableOpacity style={{ flex: 1 }} onPress={() => updateStatus('task', item.id, item.completed)}>
                                    <View style={styles.taskRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.taskTitle, item.completed && styles.completedText]}>{item.title}</Text>
                                            {item.deadlineDate && (
                                                <Text style={[styles.dateText, overdue && { color: '#FF3B30' }]}>
                                                    {overdue ? "EN RETARD" : "Limite"} : {new Date(item.deadlineDate).toLocaleDateString()}
                                                </Text>
                                            )}
                                        </View>
                                        {linkedSubs.length > 0 && (
                                            <Text style={styles.ratioText}>{done}/{linkedSubs.length}</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                                    <Text style={{ color: '#FF3B30', fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Todoux MoSCoW</Text>
                    <TouchableOpacity onPress={() => signOut(auth)}>
                        <Text style={styles.logoutText}>Déconnexion</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                    <TextInput
                        placeholder='Titre du projet'
                        placeholderTextColor="#999"
                        value={title}
                        onChangeText={setTitle}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder='Notes...'
                        placeholderTextColor="#999"
                        value={description}
                        onChangeText={setDescription}
                        style={[styles.input, { height: 60 }]}
                        multiline
                    />
                    <TextInput
                        placeholder='Inviter un collaborateur (email)'
                        placeholderTextColor="#999"
                        value={inviteEmail}
                        onChangeText={setInviteEmail}
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <View style={styles.subTaskRow}>
                        <TextInput
                            placeholder='Ajouter une étape...'
                            placeholderTextColor="#999"
                            value={subTaskInput}
                            onChangeText={setSubTaskInput}
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            onSubmitEditing={addSubTask}
                            returnKeyType="done"
                        />
                        <TouchableOpacity onPress={addSubTask} style={styles.plusButton}>
                            <Text style={{ color: '#fff', fontSize: 20, lineHeight: 22 }}>+</Text>
                        </TouchableOpacity>
                    </View>

                    {tempSubTasks.length > 0 && (
                        <View style={styles.subTaskPreview}>
                            {tempSubTasks.map((st, i) => (
                                <View key={i} style={styles.subTaskPreviewItem}>
                                    <Text style={styles.subTaskPreviewText}>• {st}</Text>
                                    <TouchableOpacity onPress={() => removeSubTask(i)}>
                                        <Text style={{ color: '#FF3B30', fontSize: 12, paddingLeft: 8 }}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={styles.switchGrid}>
                        <View style={styles.switchItem}>
                            <Text style={styles.switchLabel}>Urgent</Text>
                            <Switch value={urgent} onValueChange={setUrgent} />
                        </View>
                        <View style={styles.switchItem}>
                            <Text style={styles.switchLabel}>Important</Text>
                            <Switch value={important} onValueChange={setImportant} />
                        </View>
                        <View style={styles.switchItem}>
                            <Text style={styles.switchLabel}>Rappel</Text>
                            <Switch value={reminder} onValueChange={setReminder} />
                        </View>
                        <View style={styles.switchItem}>
                            <Text style={styles.switchLabel}>Limite</Text>
                            <Switch value={limite} onValueChange={setLimite} />
                        </View>
                    </View>

                    {reminder && (
                        <View style={styles.datePickerBox}>
                            <Text style={styles.dateLabel}>Date du rappel :</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="datetime-local"
                                    style={webInputStyle}
                                    value={reminderDate.toISOString().slice(0, 16)}
                                    onChange={(e) => setReminderDate(new Date(e.target.value))}
                                />
                            ) : (
                                <TouchableOpacity style={styles.dateButton} onPress={() => setShowReminderPicker(true)}>
                                    <Text style={styles.dateButtonText}>{reminderDate.toLocaleString()}</Text>
                                </TouchableOpacity>
                            )}
                            {showReminderPicker && (
                                <DateTimePicker
                                    value={reminderDate}
                                    mode={Platform.OS === 'android' ? reminderPickerStep : 'datetime'}
                                    onChange={handleReminderChange}
                                />
                            )}
                        </View>
                    )}

                    {limite && (
                        <View style={styles.datePickerBox}>
                            <Text style={styles.dateLabel}>Date limite :</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="datetime-local"
                                    style={webInputStyle}
                                    value={limiteDate.toISOString().slice(0, 16)}
                                    onChange={(e) => setLimiteDate(new Date(e.target.value))}
                                />
                            ) : (
                                <TouchableOpacity style={styles.dateButton} onPress={() => setShowLimitePicker(true)}>
                                    <Text style={styles.dateButtonText}>{limiteDate.toLocaleDateString()}</Text>
                                </TouchableOpacity>
                            )}
                            {showLimitePicker && (
                                <DateTimePicker
                                    value={limiteDate}
                                    mode={Platform.OS === 'android' ? limitePickerStep : 'datetime'}
                                    onChange={handleLimiteChange}
                                />
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={addTask}
                        disabled={isCreating}
                        style={[styles.addButton, isCreating && styles.addButtonDisabled]}
                    >
                        {isCreating
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.addButtonText}>CRÉER LA STRUCTURE</Text>
                        }
                    </TouchableOpacity>
                </View>

                {renderCategory("Must", false)}
                {renderCategory("Should", false)}
                {renderCategory("Could", false)}
                {renderCategory("Wont", false)}
                {tasks.filter(t => t.completed).length > 0 && renderCategory("All", true)}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
    container: { flex: 1, padding: 16 },
    header: { marginBottom: 20, padding: 20, backgroundColor: '#fff', borderRadius: 20, alignItems: 'center', elevation: 2 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E' },
    logoutText: { color: '#FF3B30', fontWeight: '600', marginTop: 4 },
    formContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 25, elevation: 4 },
    input: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 12, marginBottom: 10, fontSize: 14, color: '#000' },
    subTaskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    plusButton: { backgroundColor: '#1C1C1E', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    subTaskPreview: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 10, marginBottom: 10 },
    subTaskPreviewItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    subTaskPreviewText: { fontSize: 13, color: '#3A3A3C', flex: 1 },
    switchGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 8 },
    switchItem: { width: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F2F2F7', padding: 8, borderRadius: 10, marginBottom: 8 },
    switchLabel: { fontSize: 12, color: '#3A3A3C', fontWeight: '600' },
    datePickerBox: { backgroundColor: '#F2F2F7', padding: 10, borderRadius: 12, marginBottom: 10 },
    dateLabel: { fontSize: 12, color: '#8E8E93', fontWeight: 'bold', marginBottom: 5 },
    dateButton: { backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D1D1D6' },
    dateButtonText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
    addButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    addButtonDisabled: { opacity: 0.6 },
    addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 16, borderLeftWidth: 8, elevation: 2 },
    categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    categoryTitle: { fontSize: 12, fontWeight: '800', color: '#8E8E93', letterSpacing: 1 },
    taskContainer: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7', paddingBottom: 10 },
    taskItem: { flexDirection: 'row', alignItems: 'center' },
    taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 },
    taskTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
    dateText: { fontSize: 11, marginTop: 2, color: '#8E8E93' },
    ratioText: { fontSize: 11, fontWeight: 'bold', color: '#8E8E93' },
    deleteBtn: { padding: 10, marginLeft: 10 },
    completedText: { textDecorationLine: 'line-through', color: '#AEAEB2' }
});
