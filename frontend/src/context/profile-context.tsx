"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "@/lib/api";

interface UserProfile {
  name: string;
  username?: string;
  email: string;
  role: string;
}

interface RestaurantProfile {
  id: number;
  name: string;
  logoUrl?: string;
  bannerUrl?: string;
}

interface ProfileContextType {
  user: UserProfile | null;
  restaurant: RestaurantProfile | null;
  loading: boolean;
  refetchProfile: () => Promise<void>;
  updateContextData: (data: {
    user: UserProfile;
    restaurant: RestaurantProfile;
  }) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await api.get("/auth/me");
      setUser(res.data.user);
      setRestaurant(res.data.restaurant);
    } catch (err) {
      console.error("Failed to fetch profile in context", err);
      // Optional: don't logout immediately on loose error, but maybe good for consistency
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateContextData = (data: {
    user: UserProfile;
    restaurant: RestaurantProfile;
  }) => {
    setUser(data.user);
    setRestaurant(data.restaurant);
  };

  return (
    <ProfileContext.Provider
      value={{
        user,
        restaurant,
        loading,
        refetchProfile: fetchProfile,
        updateContextData,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
