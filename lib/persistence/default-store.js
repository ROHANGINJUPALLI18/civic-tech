import { seedComplaints, seedTechnicians } from "@/lib/mock-data";

export const defaultStore = {
  complaints: seedComplaints,
  technicians: seedTechnicians,
  logs: [
    "System booted with strict complaint lifecycle controls.",
    "AI policy: soft-flag suspicious items, never hard-block without review.",
  ],
};

export function cloneDefaultStore() {
  return JSON.parse(JSON.stringify(defaultStore));
}
