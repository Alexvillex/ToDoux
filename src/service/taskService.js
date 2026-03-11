import { db, auth } from '../../firebaseConfig';
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, 
    serverTimestamp, arrayUnion, arrayRemove 
} from 'firebase/firestore';

/**
 * --- CRÉATION ---
 * Crée une tâche et ses sous-tâches associées
 */
export const createFullTask = async (taskData, subTasks) => {
    try {
        const currentUserEmail = auth.currentUser.email;
        
        // Détermination automatique de la catégorie MoSCoW
        const category = (taskData.urgent && taskData.important) ? "Must" : 
                         (taskData.important ? "Should" : 
                         (taskData.urgent ? "Could" : "Wont"));

        // 1. Création de la tâche parente
        const taskDoc = await addDoc(collection(db, "tasks"), {
            user: auth.currentUser.uid,
            collaborators: [currentUserEmail],
            pendingCollaborators: taskData.inviteEmail.trim() !== "" ? [taskData.inviteEmail.trim()] : [],
            category: category,
            title: taskData.title.trim(),
            description: taskData.description.trim(),
            deadline: taskData.deadline,
            deadlineDate: taskData.deadline ? taskData.deadlineDate.toISOString() : '',
            hasareminder: taskData.reminder,
            reminderDate: taskData.reminder ? taskData.reminderDate.toISOString() : '',
            urgent: taskData.urgent,
            important: taskData.important,
            completed: false,
            ownerEmail: currentUserEmail,
            createdAt: serverTimestamp(),
        });

        // 2. Création des sous-tâches liées à l'ID de la tâche parente
        for (const stTitle of subTasks) {
            await addDoc(collection(db, "subtasks"), {
                parentId: taskDoc.id,
                user: auth.currentUser.uid,
                title: stTitle,
                completed: false
            });
        }
        return { success: true };
    } catch (e) { 
        console.error("Erreur création tâche :", e);
        return { success: false, error: e }; 
    }
};

/**
 * --- GESTION DES INVITATIONS ---
 * Accepter ou refuser une invitation de partage
 */
export const respondToInviteService = async (taskId, userEmail, accept) => {
    try {
        const taskRef = doc(db, "tasks", taskId);
        if (accept) {
            return await updateDoc(taskRef, {
                pendingCollaborators: arrayRemove(userEmail),
                collaborators: arrayUnion(userEmail),
            });
        }
        return await updateDoc(taskRef, { pendingCollaborators: arrayRemove(userEmail) });
    } catch (e) {
        console.error("Erreur invitation service :", e);
        throw e;
    }
};

/**
 * --- SUPPRESSION ---
 * Supprime les sous-tâches AVANT la tâche parente pour respecter les Security Rules
 */
export const deleteFullTask = async (taskId, allSubTasks) => {
    try {
        // 1. On identifie les sous-tâches liées
        const children = allSubTasks.filter(st => st.parentId === taskId);

        // 2. Suppression des enfants d'abord (Cascade inverse)
        // Cela permet aux règles Firebase de valider le parent tant qu'il existe
        await Promise.all(children.map(sub => deleteDoc(doc(db, "subtasks", sub.id))));

        // 3. Suppression de la tâche principale
        await deleteDoc(doc(db, "tasks", taskId));

        return { success: true };
    } catch (e) {
        console.error("Erreur service suppression :", e);
        return { success: false, error: e };
    }
};

/**
 * --- STATUT ---
 * Alterne l'état complété/non-complété pour tâches ou sous-tâches
 */
export const updateStatus = async (type, id, currentStatus) => {
    try {
        const collectionName = type === 'task' ? "tasks" : "subtasks";
        const ref = doc(db, collectionName, id);
        return await updateDoc(ref, { completed: !currentStatus });
    } catch (e) {
        console.error("Erreur update status :", e);
        throw e;
    }
};