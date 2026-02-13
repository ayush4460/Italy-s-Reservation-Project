import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface SlotAvailability {
  id: number;
  slotId: number;
  date: string;
  isSlotDisabled: boolean;
  isIndoorDisabled: boolean;
  isOutdoorDisabled: boolean;
}

const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
};

export const availabilityService = {
  getAvailability: async (date: string): Promise<SlotAvailability[]> => {
    const response = await axios.get(`${API_URL}/slot-availability?date=${date}`, getAuthHeader());
    return response.data;
  },

  updateAvailability: async (data: Partial<SlotAvailability>): Promise<SlotAvailability> => {
    const response = await axios.post(`${API_URL}/slot-availability`, data, getAuthHeader());
    return response.data;
  }
};
