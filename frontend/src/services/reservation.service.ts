import api from "@/lib/api";

export interface Slot {
  id: number;
  startTime: string;
  endTime: string;
  dayOfWeek?: number;
}

export interface Table {
  id: number;
  tableNumber: string;
  capacity: number;
  restaurantId: number;
}

export interface Reservation {
  id: number;
  tableId: number;
  customerName: string;
  contact: string;
  adults: number;
  kids: number;
  foodPref: string;
  specialReq?: string;
  date: string;
  slotId: number;
  status: string;
  groupId?: string;
}

export interface CreateReservationDto {
  tableId: number;
  slotId: number;
  date: string;
  customerName: string;
  contact: string;
  adults: string;
  kids: string;
  foodPref: string;
  specialReq: string;
  mergeTableIds?: number[];
}

export interface UpdateReservationDto {
  customerName: string;
  contact: string;
  adults: string;
  kids: string;
  foodPref: string;
  specialReq: string;
}

class ReservationService {
  async getSlots(date: string) {
    const response = await api.get<Slot[]>("/reservations/slots", { params: { date } });
    return response.data;
  }

  async getAllSlots() {
    const response = await api.get<Slot[]>("/reservations/slots?all=true");
    return response.data;
  }

  async createSlot(data: { startTime: string; endTime: string; days: number[] }) {
    const response = await api.post<Slot[]>("/reservations/slots", data);
    return response.data;
  }

  async deleteSlot(id: number) {
    const response = await api.delete<{ message: string }>(`/reservations/slots/${id}`);
    return response.data;
  }

  async getReservations(date: string, slotId: number) {
    const response = await api.get<Reservation[]>("/reservations", {
      params: { date, slotId },
    });
    return response.data;
  }

  async createReservation(data: CreateReservationDto) {
    const response = await api.post<Reservation>("/reservations", data);
    return response.data;
  }

  async updateReservation(id: number, data: UpdateReservationDto) {
    const response = await api.put<Reservation>(`/reservations/${id}`, data);
    return response.data;
  }

  async cancelReservation(id: number) {
    const response = await api.delete<{ message: string }>(`/reservations/${id}`);
    return response.data;
  }

  async moveReservation(id: number, newTableId: number) {
    const response = await api.put<Reservation>(`/reservations/${id}/move`, {
      newTableId,
    });
    return response.data;
  }

  // Helper to fetch tables as they are often needed with reservations
  async getTables() {
     const response = await api.get<Table[]>("/tables");
     return response.data;
  }
}

export const reservationService = new ReservationService();
