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

// Status Mapping
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

// Priority Mapping
function mapPriority(status: string): Ticket["priority"] {
  if (status === "open") return "high";
  if (status === "closed") return "low";

  return "medium";
}

// Format Ticket
function formatTicket(docSnap: any): Ticket {
  const data = docSnap.data();
  

  // Title from description
  const title =
    data.description
      ?.split(" ")
      .slice(0, 3)
      .join(" ") || "No Title";

  // Model from machine code
  const model =
    data.machineCode?.split("|")[1]?.trim() || "Unknown";

  // ✅ Read attachments safely
  const attachments =
    Array.isArray(data.attachments)
      ? data.attachments.map((item: any) => ({
          type: item.type,
          url: item.url || item.uri,

        }))
      : [];

  return {
    id: `TICKET #${String(data.ticketId).padStart(4, "0")}`,


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

  addActivity: (
    activity: Omit<Activity, "id" | "timestamp">
  ) => void;
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

      await updateDoc(doc(db, "tickets", ticketId), {
        status: "assigned",
        assigneeId: technicianId,
        assigneeName: tech.name,
        updatedAt: new Date(),
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
     Activities
  ================================ */

  activities: [],

  addActivity: (activity) => {
    const newActivity: Activity = {
      ...activity,
      id: `${Date.now()}`,
      timestamp: new Date(),
    };

    set((state) => ({
      activities: [newActivity, ...state.activities].slice(0, 20),
    }));
  },
}));
