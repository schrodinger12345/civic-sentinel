import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

// User profile stored in Firestore
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'citizen' | 'official' | null;
  onboardingComplete: boolean;
  createdAt: any; // Firestore Timestamp
  // Citizen-specific fields
  city?: string;
  phone?: string;
  location?: string;
  // Official-specific fields
  department?: string;
  designation?: string;
  jurisdiction?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  // Auth methods
  loginWithEmail: (email: string, password: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, password: string) => Promise<UserCredential>;
  loginWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  // Profile methods
  setUserRole: (role: 'citizen' | 'official') => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          role: data.role,
          onboardingComplete: data.onboardingComplete,
          createdAt: data.createdAt,
          city: data.city,
          phone: data.phone,
          location: data.location,
          department: data.department,
          designation: data.designation,
          jurisdiction: data.jurisdiction,
        } as UserProfile;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  // Create initial user profile in Firestore
  const createUserProfile = async (firebaseUser: User): Promise<UserProfile> => {
    const newProfileData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role: null,
      onboardingComplete: false,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), newProfileData);
    } catch (err) {
      console.error('Error creating user profile:', err);
      // Continue anyway - we'll create a local profile
    }

    return {
      ...newProfileData,
      createdAt: new Date(),
    } as UserProfile;
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);

      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch or create user profile
        let profile = await fetchUserProfile(firebaseUser.uid);
        
        if (!profile) {
          profile = await createUserProfile(firebaseUser);
        }
        
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Email/Password login
  const loginWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Email/Password signup
  const signUpWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      return await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Google OAuth login
  const loginWithGoogle = async () => {
    setError(null);
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Set user role after role selection
  const setUserRole = async (role: 'citizen' | 'official') => {
    if (!user) throw new Error('No user logged in');
    
    try {
      await updateDoc(doc(db, 'users', user.uid), { role } as any);
      setUserProfile((prev) => prev ? { ...prev, role } : null);
    } catch (err) {
      console.error('Error setting user role:', err);
      throw err;
    }
  };

  // Update user profile
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');
    
    // Remove undefined values and convert to plain object
    const cleanData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    
    try {
      await updateDoc(doc(db, 'users', user.uid), cleanData);
      setUserProfile((prev) => prev ? { ...prev, ...cleanData } : null);
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err;
    }
  };

  // Mark onboarding as complete
  const completeOnboarding = async () => {
    if (!user) throw new Error('No user logged in');
    
    try {
      await updateDoc(doc(db, 'users', user.uid), { onboardingComplete: true } as any);
      setUserProfile((prev) => prev ? { ...prev, onboardingComplete: true } : null);
    } catch (err) {
      console.error('Error completing onboarding:', err);
      throw err;
    }
  };

  // Refresh user profile from Firestore
  const refreshUserProfile = async () => {
    if (!user) return;
    
    const profile = await fetchUserProfile(user.uid);
    if (profile) {
      setUserProfile(profile);
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    error,
    loginWithEmail,
    signUpWithEmail,
    loginWithGoogle,
    logout,
    setUserRole,
    updateUserProfile,
    completeOnboarding,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
