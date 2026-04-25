import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useStore } from '@/store';
import { Loader2 } from 'lucide-react';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { login, logout, isInitializing, setInitializing } = useStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const q = query(collection(db, "user"), where("uid", "==", firebaseUser.uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            login({
              id: querySnapshot.docs[0].id,
              uid: firebaseUser.uid,
              name: userData.name,
              email: userData.email,
              role: userData.role,
            });
          } else {
            logout();
          }
        } catch (error) {
          console.error("Error restoring session:", error);
          logout();
        }
      } else {
        logout();
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [login, logout, setInitializing]);

  if (isInitializing) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0B1221] text-white">
        <div className="mb-8">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold tracking-widest text-blue-400 animate-pulse">
            APEX SERVICE FLOW
        </h2>
        <p className="mt-4 text-gray-500 text-xs font-medium tracking-widest">
            INITIALIZING SECURE SESSION
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
