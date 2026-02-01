import { create } from "zustand";

import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

import { db } from "@/firebase";

/* ===============================
   Interfaces
================================ */

export interface User {
  id: string;
  name: string;
  email: string;
  role: "technician" | "manager";
  phone: string;
  status: "online" | "offline";
  activeJobs: number;
}

export interface Attachment {
  type: "image" | "video" | "audio";
  url: string;
}

export interface Ticket {
  id: string;
  displayId: string;
  title: string;
  description: string;

  status: "new" | "assigned" | "in-progress" | "completed" | "declined";
  priority: "low" | "medium" | "high" | "urgent";

  assigneeId: string | null;
  assigneeName: string | null;

  location: string;

  customerName: string;
  customerPhone: string;

  createdAt: Date;
  updatedAt: Date;

  machineCode?: string;

  attachments?: Attachment[];
}

export interface Activity {
  id: string;
  action: string;
  timestamp: Date;
  type: "assignment" | "status" | "creation" | "completion";
}

/* ===============================
   Helpers
================================ */

function mapStatus(status: string): Ticket["status"] {
  switch (status) {
    case "open":
      return "new";
    case "assigned":
      return "assigned";
    case "in progress":
    case "waiting_for_confirmation":
      return "in-progress";
    case "denied":
      return "declined";
    case "closed":
      return "completed";
    default:
      return "new";
  }
}

function mapPriority(status: string): Ticket["priority"] {
  if (status === "open") return "high";
  if (status === "closed") return "low";
  return "medium";
}

function formatTicket(docSnap: any): Ticket {
  const data = docSnap.data();

  const title =
    data.description?.split(" ").slice(0, 3).join(" ") || "No Title";

  const attachments =
    Array.isArray(data.attachments)
      ? data.attachments.map((item: any) => ({
          type: item.type,
          url: item.url || item.uri,
        }))
      : [];

  return {
    id: docSnap.id,

    displayId: `TICKET #${String(data.ticketId).padStart(4, "0")}`,

    title,

    description: data.description || "",

    status: mapStatus(data.status),

    priority: mapPriority(data.status),

    assigneeId: data.assigneeId || null,

    assigneeName: data.assigneeName || null,

    location: "xxxx",

    customerName: data.userName || "Unknown",

    customerPhone: data.phone || "",

    createdAt: data.createdAt?.toDate() || new Date(),

    updatedAt: data.updatedAt?.toDate() || new Date(),

    machineCode: data.machineCode,

    attachments,
  };
}

/* ===============================
   Store Interface
================================ */

interface AppState {
  // Auth
  isAuthenticated: boolean;
  currentUser: { name: string; email: string; role: string } | null;

  login: (email: string, password: string) => boolean;
  logout: () => void;

  // Technicians
  technicians: User[];

  fetchTechnicians: () => Promise<void>;

  addTechnician: (
    tech: Omit<User, "id" | "status" | "activeJobs">
  ) => Promise<void>;

  deleteTechnician: (id: string) => Promise<void>;

  updateTechnician: (
    id: string,
    updates: Partial<User>
  ) => Promise<void>;

  // Tickets
  tickets: Ticket[];

  fetchTickets: () => Promise<void>;

  updateTicket: (
    id: string,
    updates: Partial<Ticket>
  ) => Promise<void>;

  assignTicket: (
    ticketId: string,
    technicianId: string
  ) => Promise<void>;

  // Activities
  activities: Activity[];

  listenToActivities: () => () => void;
}

/* ===============================
   Store
================================ */

export const useStore = create<AppState>((set, get) => ({
  /* ===============================
     Auth
  ================================ */

  isAuthenticated: false,

  currentUser: null,

  login: (email, password) => {
    if (email && password) {
      set({
        isAuthenticated: true,
        currentUser: {
          name: "Admin",
          email,
          role: "Super Admin",
        },
      });
      return true;
    }
    return false;
  },

  logout: () => {
    set({
      isAuthenticated: false,
      currentUser: null,
    });
  },

  /* ===============================
     Technicians
  ================================ */

  technicians: [],

  fetchTechnicians: async () => {
    try {
      const q = query(
        collection(db, "user"),
        where("role", "in", ["technician", "manager"])
      );

      const snap = await getDocs(q);

      const users: User[] = snap.docs.map((d) => {
        const data = d.data() as any;

        return {
          id: d.id,
          name: data.name,
          email: data.email,
          role: data.role,
          phone: data.phone || "",
          status: data.status || "offline",
          activeJobs: data.activeJobs || 0,
        };
      });

      set({ technicians: users });
    } catch (err) {
      console.error("Fetch technicians error:", err);
    }
  },

  addTechnician: async (tech) => {
    try {
      const ref = await addDoc(collection(db, "user"), {
        ...tech,
        status: "offline",
        activeJobs: 0,
      });

      const newTech: User = {
        ...tech,
        id: ref.id,
        status: "offline",
        activeJobs: 0,
      };

      set((state) => ({
        technicians: [...state.technicians, newTech],
      }));
    } catch (err) {
      console.error("Add technician error:", err);
    }
  },

  deleteTechnician: async (id) => {
    try {
      await deleteDoc(doc(db, "user", id));

      set((state) => ({
        technicians: state.technicians.filter((t) => t.id !== id),
      }));
    } catch (err) {
      console.error("Delete technician error:", err);
    }
  },

  updateTechnician: async (id, updates) => {
    try {
      await updateDoc(doc(db, "user", id), updates);

      set((state) => ({
        technicians: state.technicians.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      }));
    } catch (err) {
      console.error("Update technician error:", err);
    }
  },

  /* ===============================
     Tickets
  ================================ */

  tickets: [],

  fetchTickets: async () => {
    try {
      const snap = await getDocs(collection(db, "tickets"));

      const tickets: Ticket[] = snap.docs.map(formatTicket);

      set({ tickets });
    } catch (err) {
      console.error("Fetch tickets error:", err);
    }
  },

  updateTicket: async (id, updates) => {
    try {
      await updateDoc(doc(db, "tickets", id), {
        ...updates,
        updatedAt: new Date(),
      });

      if (updates.status) {
        await addDoc(collection(db, "activities"), {
          type: updates.status === "completed" ? "completion" : "status",
          action: `Ticket ${id} marked as ${updates.status}`,
          timestamp: serverTimestamp(),
          status: "active",
        });
      }

      set((state) => ({
        tickets: state.tickets.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      }));
    } catch (err) {
      console.error("Update ticket error:", err);
    }
  },

  assignTicket: async (ticketId, technicianId) => {
    try {
      const tech = get().technicians.find(
        (t) => t.id === technicianId
      );

      if (!tech) return;

      const ticket = get().tickets.find(
        (t) => t.id === ticketId
      );

      const ticketNo = ticket?.displayId || ticketId;

      await updateDoc(doc(db, "tickets", ticketId), {
        status: "assigned",
        assigneeId: technicianId,
        assigneeName: tech.name,
        updatedAt: new Date(),
      });

      await addDoc(collection(db, "activities"), {
        type: "assignment",
        action: `${tech.name} assigned ${ticketNo}`,
        timestamp: serverTimestamp(),
        status: "active",
      });

      set((state) => ({
        tickets: state.tickets.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: "assigned",
                assigneeId: technicianId,
                assigneeName: tech.name,
              }
            : t
        ),

        technicians: state.technicians.map((t) =>
          t.id === technicianId
            ? { ...t, activeJobs: t.activeJobs + 1 }
            : t
        ),
      }));
    } catch (err) {
      console.error("Assign ticket error:", err);
    }
  },

  /* ===============================
     Activities (Realtime)
  ================================ */

  activities: [],

  listenToActivities: () => {
    const q = query(
      collection(db, "activities"),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const activities: Activity[] = snap.docs.map((d) => {
        const data = d.data() as any;

        return {
          id: d.id,
          action: data.action,
          type: data.type,
          timestamp: data.timestamp?.toDate() || new Date(),
        };
      });

      set({ activities });
    });

    return unsubscribe;
  },
}));
