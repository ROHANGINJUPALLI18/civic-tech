import { seedComplaints, seedTechnicians } from "@/lib/mock-data";

export const defaultStore = {
  complaints: seedComplaints,
  technicians: seedTechnicians,
  logs: [],
};

export function cloneDefaultStore() {
  return JSON.parse(JSON.stringify(defaultStore));
}
