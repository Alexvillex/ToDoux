import { Platform, StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, arrayUnion, or, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AuthScreen from './Login';
import React, { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function HomeScreen() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [Invites, setInvites] = useState([]);
    
    /* --- ÉTAT DU FORMULAIRE --- */
    const [Title, setTitle] = useState('');
    const [Description, setDescription] = useState('');
    const [Limite, setLimite] = useState(false);
    const [LimiteDate, setLimiteDate] = useState(new Date());
    const [Urgent, setUrgent] = useState(false);
    const [Important, setImportant] = useState(false);
    const [Reminder, setReminder] = useState(false);
    const [ReminderDate, setReminderDate] = useState(new Date());
    const [InviteEmail, SetInviteEmail] = useState('');
    const [UserEmail, setUserEmail] = useState('');

    /* --- GESTION DES SOUS-TÂCHES --- */
    const [subTaskInput, setSubTaskInput] = useState('');
    const [tempSubTasks, setTempSubTasks] = useState([]); 

    /* --- DONNÉES TEMPS RÉEL --- */
    const [task, setTask] = useState([]);
    const [allSubTasks, setAllSubTasks] = useState([]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setLoading(false);
            
            if (currentUser) {
                setUser(currentUser);
                const CurrentEmail = currentUser.email;
                setUserEmail(CurrentEmail);

                const qInvites = query(
                    collection(db, "tasks"),
                    where("pendingCollaborators", 'array-contains', CurrentEmail)
                );
                const snapshotOptions = {
                    next: (snapshot) => {
                        const loadedTasks = snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() }));
                        // TRI CHRONOLOGIQUE : Plus récent en haut (basé sur createdAt)
                        setTask(loadedTasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
                    },
                    error: (error) => {
                        if (error.name !== 'FirebaseError' || error.code !== 'cancelled') {
                            console.error("Firestore Tasks Error:", error);
                        }
                    }
                };

                const q = query(collection(db, "tasks"),or( where("user", "==", currentUser.uid), where("collaborators", "array-contains", CurrentEmail) ));
                const unsubTasks = onSnapshot(q, snapshotOptions);

                const qSub = query(collection(db, "subtasks"));
                const unsubSubs = onSnapshot(qSub, (snapshot) => {
                    setAllSubTasks(snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() })));
                });
                const unsubInvites = onSnapshot(qInvites, (snapshot) => {
                    setInvites(snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() })));
                });

                return () => { unsubTasks(); unsubSubs(); unsubInvites() };
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const respondToInvite = async (taskId, accept) =>{
        const taskRef = doc(db, "tasks", taskId);
        
        try{
            if(accept){
                await updateDoc(taskRef, {
                    pendingCollaborators : arrayRemove(UserEmail),
                    collaborators : arrayUnion(UserEmail),
                })
                Alert.alert("Vous partagez une tache")
            }else{
                await updateDoc(taskRef, {
                    pendingCollaborators : arrayRemove(UserEmail),
                })
            }
        }catch (error){
            console.error("Erreur d'invitation", error)
        }

    };
    const addTask = async () => {
        if (!Title.trim()) {
            alert("Veuillez entrer un titre ! 🦾");
            return;
        }
        
        
        const cleanInvite = InviteEmail.trim();
            const currentUserEmail = auth.currentUser.email;
            if (cleanInvite === currentUserEmail){
                alert("Tu ne peux pas t'inviter toi-meme");
                return;
            }
            let maCategorie = (Urgent && Important) ? "Must" : (Important ? "Should" : (Urgent ? "Could" : "Won't"));

        try {
            const taskDoc = await addDoc(collection(db, "tasks"), {
                user: auth.currentUser.uid,
                collaborators:[currentUserEmail],
                pendingCollaborators: cleanInvite !== "" ? [cleanInvite]:[],
                category: maCategorie,
                title: Title.trim(),
                description: Description.trim(),
                deadline: Limite,
                deadlineDate: Limite ? LimiteDate.toISOString() : '', 
                hasareminder: Reminder,
                reminderDate: Reminder ? ReminderDate.toISOString() : '',
                urgent: Urgent,
                important: Important,
                completed: false,
                ownerEmail: currentUserEmail,
                createdAt: serverTimestamp(),
            });

            for (const stTitle of tempSubTasks) {
                await addDoc(collection(db, "subtasks"), {
                    parentId: taskDoc.id,
                    user: auth.currentUser.uid,
                    title: stTitle,
                    completed: false
                });
            }

            SetInviteEmail('');setTitle(''); setDescription(''); setTempSubTasks([]); setLimite(false);
            setUrgent(false); setImportant(false); setReminder(false);
        } catch (error) { console.error("Erreur d'écriture : ", error); }
    };

    /**
     * ANTI-CON : Bloque la complétion si les sous-tâches ne sont pas finies
     */
    const toggleComplete = async (id, currentStatus) => {
        const linkedSubs = allSubTasks.filter(st => st.parentId === id);
        const total = linkedSubs.length;
        const done = linkedSubs.filter(st => st.completed).length;

        // Si on veut cocher "Terminé" (currentStatus est false) mais que tout n'est pas fait
        if (!currentStatus && total > 0 && done < total) {
            const msg = "Action bloquée : Toutes les sous-tâches ne sont pas terminées ! 🛑";
            if (Platform.OS === 'web') {
                alert(msg);
            } else {
                Alert.alert("Anti-con", msg);
            }
            return;
        }

        await updateDoc(doc(db, "tasks", id), { completed: !currentStatus });
    };

    const toggleSubTask = async (subId, currentStatus) => {
        await updateDoc(doc(db, "subtasks", subId), { completed: !currentStatus });
    };

    const deleteTask = async (id) => {
        try {
            await deleteDoc(doc(db, "tasks", id));
            const childrenToDelete = allSubTasks.filter(st => st.parentId === id);
            await Promise.all(childrenToDelete.map(sub => deleteDoc(doc(db, "subtasks", sub.id))));
        } catch (error) { console.error("Erreur suppression :", error); }
    };

    const isOverdue = (dateIso) => {
        if (!dateIso) return false;
        return new Date() > new Date(dateIso);
    };

    const renderCategory = (categoryKey, label, emoji, color, showCompletedOnly) => (
        <View key={categoryKey} style={[styles.card, { borderLeftColor: color }]}>
            <Text style={styles.categoryTitle}>{emoji} {label}</Text>
            {task.filter(t => {
                const matchCategory = categoryKey === "All" ? true : t.category === categoryKey;
                const matchStatus = t.completed === showCompletedOnly;
                return matchCategory && matchStatus;
            })
            .map((item) => {
                const linkedSubs = allSubTasks.filter(st => st.parentId === item.id);
                const done = linkedSubs.filter(st => st.completed).length;
                const total = linkedSubs.length;
                const ratio = total > 0 ? (done / total) * 100 : 0;
                const overdue = isOverdue(item.deadlineDate) && !item.completed;

                return (
                    <View key={item.id} style={styles.taskContainer}>
                        <View style={styles.taskItem}>
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleComplete(item.id, item.completed)}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.taskTitle, item.completed && styles.completedText]}>
                                            {item.completed ? "✅ " : (overdue ? "⚠️ " : "• ")}{item.title}
                                        </Text>
                                        {item.deadlineDate ? (
                                            <Text style={[styles.dateText, overdue && { color: 'red', fontWeight: 'bold' }]}>
                                                {overdue ? "EN RETARD : " : "Limite : "}
                                                {new Date(item.deadlineDate).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        ) : null}
                                    </View>
                                    {total > 0 && <Text style={styles.ratioText}>{done}/{total}</Text>}
                                </View>
                                {total > 0 && (
                                    <View style={styles.progressBg}>
                                        <View style={[styles.progressFill, { width: `${ratio}%`, backgroundColor: color }]} />
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteTask(item.id)} style={{ padding: 10 }}><Text style={{ color: 'red' }}>✕</Text></TouchableOpacity>
                        </View>
                        {linkedSubs.map((sub) => (
                            <TouchableOpacity key={sub.id} onPress={() => toggleSubTask(sub.id, sub.completed)} style={styles.subTaskItem}>
                                <Text style={[styles.subTaskText, sub.completed && styles.completedText]}>
                                    {sub.completed ? "☑ " : "☐ "}{sub.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            })}
        </View>
    );

    if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} color="#2c3e50" />;
    if (!user) return <AuthScreen />;

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Todoux MoSCoW</Text>
                    <TouchableOpacity onPress={() => signOut(auth)}><Text style={styles.logoutText}>Déconnexion</Text></TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                    <TextInput placeholder='Titre du projet' value={Title} onChangeText={setTitle} style={styles.input} />
                    <TextInput placeholder='Notes (optionnel)' value={Description} onChangeText={setDescription} style={styles.input} multiline />
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <TextInput placeholder='Étape de réalisation...' value={subTaskInput} onChangeText={setSubTaskInput} style={[styles.input, { flex: 1, marginBottom: 0 }]} />
                        <TouchableOpacity onPress={() => { if(subTaskInput) { setTempSubTasks([...tempSubTasks, subTaskInput]); setSubTaskInput(''); }}} style={styles.plusButton}><Text style={{ color: '#fff' }}>+</Text></TouchableOpacity>
                    </View>
                    {tempSubTasks.map((t, i) => <Text key={i} style={styles.tempText}>- {t}</Text>)}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15, marginTop: 10 }}>
                        <View style={styles.switchBox}><Text>Urgent</Text><Switch value={Urgent} onValueChange={setUrgent} /></View>
                        <View style={styles.switchBox}><Text>Important</Text><Switch value={Important} onValueChange={setImportant} /></View>
                        <View style={styles.switchBox}><Text>Rappel</Text><Switch value={Reminder} onValueChange={setReminder} /></View>
                        <View style={styles.switchBox}><Text>Limite</Text><Switch value={Limite} onValueChange={setLimite} /></View>
                    </View>

                    {Reminder && (Platform.OS === 'web' ? <input type="datetime-local" style={webInputStyle} onChange={(e) => setReminderDate(new Date(e.target.value))} /> : <DateTimePicker value={ReminderDate} mode="datetime" display="inline" onChange={(e, d) => setReminderDate(d || ReminderDate)} />)}
                    {Limite && (Platform.OS === 'web' ? <input type="datetime-local" style={webInputStyle} onChange={(e) => setLimiteDate(new Date(e.target.value))} /> : <DateTimePicker value={LimiteDate} mode="datetime" display="inline" onChange={(e, d) => setLimiteDate(d || LimiteDate)} />)}
                    <View style={styles.inputContainer}>
                        <TextInput 
                        placeholder='Inviter un ami (email)'
                        value={InviteEmail}
                        onChangeText={SetInviteEmail}
                        style={styles.input}
                        keyboardType='email-address'
                        autoCapitalize='none'
                        >
                        </TextInput>
                    </View>
                    <TouchableOpacity onPress={addTask} style={styles.addButton}><Text style={{ color: '#fff', fontWeight: 'bold' }}>CRÉER LA STRUCTURE</Text></TouchableOpacity>
                </View>
                {renderCategory("Must", "À FAIRE ABSOLUMENT", "🔴", "#FF4136")}
                {renderCategory("Should", "À FAIRE PRIORITAIREMENT", "🟠", "#FF851B")}
                {renderCategory("Could", "SI J'AI LE TEMPS", "🟡", "#FFDC00")}
                {renderCategory("Won't", "À REPORTER", "⚪", "#AAAAAA")}
                {/* 📩 SECTION DES INVITATIONS REÇUES */}
                {Invites.length > 0 && (
                    <View style={{ backgroundColor: '#ebf5fb', padding: 15, borderRadius: 12, marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2980b9', marginBottom: 10 }}>
                        📩 Invitations en attente ({Invites.length})
                    </Text>
                    {Invites.map((item) => (
                        <View key={item.id} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
                                <Text style={{ fontSize: 11, color: '#7f8c8d' }}>De : {item.ownerEmail}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <TouchableOpacity 
                                    onPress={() => respondToInvite(item.id, true)} 
                                    style={{ backgroundColor: '#2ecc71', padding: 8, borderRadius: 6 }}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>OUI</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => respondToInvite(item.id, false)} 
                                    style={{ backgroundColor: '#e74c3c', padding: 8, borderRadius: 6, marginLeft: 8 }}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>NON</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        ))}
                    </View>
                )}
                {/* SECTION ARCHIVES (Tâches terminées) */}
                {task.filter(t => t.completed).length > 0 && (
                    <View style={{ marginTop: 30, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 }}>
                        <Text style={[styles.categoryTitle, { color: '#7f8c8d', textAlign: 'center' }]}>
                            📁 ARCHIVES (TERMINÉES)
                        </Text>
                        {renderCategory("All", "Archives", "✅", "#2ecc71", true)} 
                    </View>
)}
            </ScrollView>
        </SafeAreaView>
    );
}

const webInputStyle = { borderWidth: 0, backgroundColor: '#f1f2f6', borderRadius: 8, padding: 10, color: '#2c3e50', marginTop: 10, width: '100%' };

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
    container: { flex: 1, padding: 15 },
    header: { marginBottom: 20, padding: 15, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    logoutText: { color: 'red', marginTop: 5 },
    formContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 25 },
    input: { borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 15, paddingVertical: 8 },
    switchBox: { flexDirection: 'row', alignItems: 'center', marginRight: 15, marginBottom: 10 },
    plusButton: { backgroundColor: '#2c3e50', padding: 10, borderRadius: 8, marginLeft: 10 },
    tempText: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 2 },
    addButton: { backgroundColor: '#2c3e50', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderLeftWidth: 10 },
    categoryTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10, color: '#7f8c8d' },
    taskContainer: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f9f9f9', paddingBottom: 10 },
    taskItem: { flexDirection: 'row', alignItems: 'center' },
    taskTitle: { fontSize: 15, fontWeight: '600' },
    dateText: { fontSize: 11, color: '#95a5a6', marginTop: 2 },
    ratioText: { fontSize: 12, fontWeight: 'bold', color: '#7f8c8d' },
    progressBg: { height: 4, backgroundColor: '#eee', borderRadius: 2, marginTop: 5, overflow: 'hidden' },
    progressFill: { height: '100%' },
    subTaskItem: { marginLeft: 20, marginTop: 8 },
    subTaskText: { fontSize: 13, color: '#555' },
    completedText: { textDecorationLine: 'line-through', color: '#aaa' }
});