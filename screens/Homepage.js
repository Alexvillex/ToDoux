import { Platform, StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, or } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

// Importation synchronisée avec TaskService.js
import { createFullTask, deleteFullTask, updateStatus } from '../src/service/taskService';

const MOSCOW_CONFIG = {
    Must: { label: "À FAIRE ABSOLUMENT", color: "#FF4136" },
    Should: { label: "À FAIRE PRIORITAIREMENT", color: "#FF851B" },
    Could: { label: "SI J'AI LE TEMPS", color: "#FFDC00" },
    Wont: { label: "À REPORTER", color: "#AAAAAA" },
    All: { label: "ARCHIVES", color: "#34C759" }
};

const webInputStyle = { borderWidth: 1, borderColor: '#D1D1D6', backgroundColor: '#fff', borderRadius: 8, padding: 8, color: '#007AFF', fontWeight: '600', fontSize: 14, marginTop: 5 };

export default function HomeScreen() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [Title, setTitle] = useState('');
    const [Description, setDescription] = useState('');
    const [Limite, setLimite] = useState(false);
    const [LimiteDate, setLimiteDate] = useState(new Date());
    const [Urgent, setUrgent] = useState(false);
    const [Important, setImportant] = useState(false);
    const [Reminder, setReminder] = useState(false);
    const [ReminderDate, setReminderDate] = useState(new Date());
    const [InviteEmail, SetInviteEmail] = useState('');

    const [showReminderPicker, setShowReminderPicker] = useState(false);
    const [showLimitePicker, setShowLimitePicker] = useState(false);

    const [subTaskInput, setSubTaskInput] = useState('');
    const [tempSubTasks, setTempSubTasks] = useState([]); 
    const [task, setTask] = useState([]);
    const [allSubTasks, setAllSubTasks] = useState([]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setLoading(false);
            if (currentUser) {
                setUser(currentUser);

                const q = query(collection(db, "tasks"), or(where("user", "==", currentUser.uid), where("collaborators", "array-contains", currentUser.email)));
                
                const unsubTasks = onSnapshot(q, {
                    next: (snapshot) => {
                        const loadedTasks = snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() }));
                        setTask(loadedTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
                    },
                    error: (error) => console.error("Erreur Tasks Snapshot:", error)
                });
                
                const unsubSubs = onSnapshot(query(collection(db, "subtasks")), (snapshot) => { 
                    setAllSubTasks(snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() }))); 
                });

                return () => { unsubTasks(); unsubSubs(); };
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const addTask = async () => {
        if (!Title.trim()) { alert("Titre requis !"); return; }
        const taskData = { 
            title: Title, description: Description, inviteEmail: InviteEmail, 
            urgent: Urgent, important: Important, deadline: Limite, 
            deadlineDate: Limite ? LimiteDate : null, 
            reminder: Reminder, reminderDate: Reminder ? ReminderDate : null 
        };

        try {
            const result = await createFullTask(taskData, tempSubTasks);
            if (result.success) {
                SetInviteEmail(''); setTitle(''); setDescription(''); setTempSubTasks([]); 
                setLimite(false); setUrgent(false); setImportant(false); setReminder(false);
            }
        } catch (error) { console.error(error); }
    };

    // Nouvelle fonction de suppression avec gestion d'erreur Alert
    const handleDelete = async (taskId) => {
        const result = await deleteFullTask(taskId, allSubTasks);
        if (!result.success) {
            Alert.alert("Action refusée", "Vous n'avez pas les permissions pour supprimer cette tâche.");
        }
    };

    const renderCategory = (categoryKey, showCompletedOnly) => {
        const config = MOSCOW_CONFIG[categoryKey];
        const filteredTasks = task.filter(t => (categoryKey === "All" ? true : t.category === categoryKey) && t.completed === showCompletedOnly);
        if (filteredTasks.length === 0 && categoryKey !== "All") return null;

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
                                        {linkedSubs.length > 0 && <Text style={styles.ratioText}>{done}/{linkedSubs.length}</Text>}
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

    if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} color="#007AFF" />;

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Todoux MoSCoW</Text>
                    <TouchableOpacity onPress={() => signOut(auth)}><Text style={styles.logoutText}>Déconnexion</Text></TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                    <TextInput placeholder='Titre du projet' placeholderTextColor="#999" value={Title} onChangeText={setTitle} style={styles.input} />
                    <TextInput placeholder='Notes...' placeholderTextColor="#999" value={Description} onChangeText={setDescription} style={[styles.input, { height: 60 }]} multiline />
                    <View style={styles.subTaskRow}>
                        <TextInput placeholder='Étape...' placeholderTextColor="#999" value={subTaskInput} onChangeText={setSubTaskInput} style={[styles.input, { flex: 1, marginBottom: 0 }]} />
                        <TouchableOpacity onPress={() => { if(subTaskInput) { setTempSubTasks([...tempSubTasks, subTaskInput]); setSubTaskInput(''); }}} style={styles.plusButton}><Text style={{ color: '#fff' }}>+</Text></TouchableOpacity>
                    </View>
                    <View style={styles.switchGrid}>
                        <View style={styles.switchItem}><Text style={styles.switchLabel}>Urgent</Text><Switch value={Urgent} onValueChange={setUrgent} /></View>
                        <View style={styles.switchItem}><Text style={styles.switchLabel}>Important</Text><Switch value={Important} onValueChange={setImportant} /></View>
                        <View style={styles.switchItem}><Text style={styles.switchLabel}>Rappel</Text><Switch value={Reminder} onValueChange={setReminder} /></View>
                        <View style={styles.switchItem}><Text style={styles.switchLabel}>Limite</Text><Switch value={Limite} onValueChange={setLimite} /></View>
                    </View>

                    {Reminder && (
                        <View style={styles.datePickerBox}>
                            <Text style={styles.dateLabel}>Rappel :</Text>
                            {Platform.OS === 'web' ? (
                                <input type="datetime-local" style={webInputStyle} value={ReminderDate.toISOString().slice(0, 16)} onChange={(e) => setReminderDate(new Date(e.target.value))} />
                            ) : (
                                <TouchableOpacity style={styles.dateButton} onPress={() => setShowReminderPicker(true)}>
                                    <Text style={styles.dateButtonText}>{ReminderDate.toLocaleString()}</Text>
                                </TouchableOpacity>
                            )}
                            {showReminderPicker && ( <DateTimePicker value={ReminderDate} mode="datetime" onChange={(e, d) => { setShowReminderPicker(false); if(d) setReminderDate(d); }} /> )}
                        </View>
                    )}

                    {Limite && (
                        <View style={styles.datePickerBox}>
                            <Text style={styles.dateLabel}>Limite :</Text>
                            {Platform.OS === 'web' ? (
                                <input type="datetime-local" style={webInputStyle} value={LimiteDate.toISOString().slice(0, 16)} onChange={(e) => setLimiteDate(new Date(e.target.value))} />
                            ) : (
                                <TouchableOpacity style={styles.dateButton} onPress={() => setShowLimitePicker(true)}>
                                    <Text style={styles.dateButtonText}>{LimiteDate.toLocaleDateString()}</Text>
                                </TouchableOpacity>
                            )}
                            {showLimitePicker && ( <DateTimePicker value={LimiteDate} mode="date" onChange={(e, d) => { setShowLimitePicker(false); if(d) setLimiteDate(d); }} /> )}
                        </View>
                    )}
                    
                    <TouchableOpacity onPress={addTask} style={styles.addButton}><Text style={styles.addButtonText}>CRÉER LA STRUCTURE</Text></TouchableOpacity>
                </View>

                {renderCategory("Must", false)}
                {renderCategory("Should", false)}
                {renderCategory("Could", false)}
                {renderCategory("Wont", false)}
                {task.filter(t => t.completed).length > 0 && renderCategory("All", true)}
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
    switchGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 8 },
    switchItem: { width: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F2F2F7', padding: 8, borderRadius: 10, marginBottom: 8 },
    switchLabel: { fontSize: 12, color: '#3A3A3C', fontWeight: '600' },
    datePickerBox: { backgroundColor: '#F2F2F7', padding: 10, borderRadius: 12, marginBottom: 10 },
    dateLabel: { fontSize: 12, color: '#8E8E93', fontWeight: 'bold', marginBottom: 5 },
    dateButton: { backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D1D1D6' },
    dateButtonText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
    addButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
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