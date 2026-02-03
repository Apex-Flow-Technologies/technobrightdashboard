import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* -------------------------------------------------------------------------- */
/* TYPES */
/* -------------------------------------------------------------------------- */

export type MachinePayload = {
  machineCode: string;
  status: string; // stored as "online" | "offline" in DB
  assignedTo: string | null; // customer document id
};

/* -------------------------------------------------------------------------- */
/* COLLECTION REF */
/* -------------------------------------------------------------------------- */

const machinesRef = collection(db, "machines");

/* -------------------------------------------------------------------------- */
/* FETCH */
/* -------------------------------------------------------------------------- */

export const fetchMachines = async () => {
  const snapshot = await getDocs(machinesRef);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

/* -------------------------------------------------------------------------- */
/* ADD */
/* -------------------------------------------------------------------------- */

export const addMachine = async (machine: MachinePayload) => {
  await addDoc(machinesRef, {
    machineCode: machine.machineCode,
    status: machine.status,           // "online" | "offline"
    assignedTo: machine.assignedTo,   // null allowed
    createdAt: serverTimestamp(),
  });
};

/* -------------------------------------------------------------------------- */
/* UPDATE */
/* -------------------------------------------------------------------------- */

export const updateMachine = async (
  id: string,
  data: MachinePayload
) => {
  const ref = doc(db, "machines", id);

  await updateDoc(ref, {
    machineCode: data.machineCode,
    status: data.status,
    assignedTo: data.assignedTo,
    updatedAt: serverTimestamp(),
  });
};

/* -------------------------------------------------------------------------- */
/* DELETE */
/* -------------------------------------------------------------------------- */

export const deleteMachine = async (id: string) => {
  const ref = doc(db, "machines", id);
  await deleteDoc(ref);
};
