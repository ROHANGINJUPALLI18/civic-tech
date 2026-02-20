"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ScanLine, ShieldAlert } from "lucide-react";

import { SpotlightBanner } from "@/components/civic/spotlight-banner";
import { ReactBitsChip } from "@/components/civic/reactbits-chip";
import { Button } from "@/components/ui/button";
import { CameraModal } from "@/components/civic/camera-modal";
import { computeTechnicianTrust } from "@/lib/workflow";

const STATE_BADGE = {
  Reported: "bg-slate-100 text-slate-700",
  "AI Pre-Validation": "bg-indigo-100 text-indigo-700",
  "Community Review": "bg-amber-100 text-amber-700",
  Verified: "bg-blue-100 text-blue-700",
  Assigned: "bg-cyan-100 text-cyan-700",
  "In Progress": "bg-lime-100 text-lime-700",
  "Work Uploaded": "bg-sky-100 text-sky-700",
  "AI Resolution Validation": "bg-violet-100 text-violet-700",
  "Manager Review": "bg-orange-100 text-orange-700",
  Completed: "bg-green-100 text-green-700",
  "User Confirmation": "bg-fuchsia-100 text-fuchsia-700",
  Closed: "bg-emerald-100 text-emerald-700",
};

function badgeClass(state) {
  return STATE_BADGE[state] || "bg-slate-100 text-slate-700";
}

function Notice({ type = "info", children }) {
  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "success"
        ? "border-green-200 bg-green-50 text-green-700"
        : type === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

function Pill({ children, tone = "blue" }) {
  const styles =
    tone === "purple"
      ? "bg-purple-100 text-purple-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [complaints, setComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const [sessionUser, setSessionUser] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const [authorityFilter, setAuthorityFilter] = useState("all");
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [techSubmission, setTechSubmission] = useState({});
  const [cameraOpen, setCameraOpen] = useState(null);

  const setBusy = (id, value) => {
    setBusyIds((current) => {
      if (value && !current.includes(id)) return [...current, id];
      if (!value) return current.filter((item) => item !== id);
      return current;
    });
  };

  const applyStore = (store) => {
    setComplaints(store.complaints ?? []);
    setTechnicians(store.technicians ?? []);
    setLogs(store.logs ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [bootstrapResponse, sessionResponse] = await Promise.all([
          fetch("/api/bootstrap", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);

        if (!bootstrapResponse.ok)
          throw new Error("Failed to load bootstrap state");

        if (sessionResponse.ok) {
          const sessionPayload = await sessionResponse.json();
          setSessionUser(sessionPayload.user ?? null);
        }

        const store = await bootstrapResponse.json();
        applyStore(store);
        if (store.complaints?.length)
          setSelectedComplaintId(store.complaints[0].id);
      } catch {
        setFeedback({ type: "error", text: "Unable to load server state." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const managerRows = useMemo(
    () =>
      technicians
        .map((technician) => {
          const trust = computeTechnicianTrust(technician);
          return {
            ...technician,
            trust,
            assignmentStatus: trust < 20 ? "Restricted" : "Open",
          };
        })
        .sort((a, b) => b.trust - a.trust),
    [technicians],
  );

  const authorityRows = useMemo(() => {
    if (authorityFilter === "all") return complaints;
    return complaints.filter((item) => item.department === authorityFilter);
  }, [authorityFilter, complaints]);

  const selectedComplaint = useMemo(
    () => complaints.find((item) => item.id === selectedComplaintId),
    [complaints, selectedComplaintId],
  );

  const assignedForTechnicians = useMemo(
    () => complaints.filter((item) => item.assignedTechnicianId),
    [complaints],
  );

  const callAndApply = async (url, options = {}, fallbackMessage) => {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(fallbackMessage || "Request failed");
    const payload = await response.json();
    const nextStore = payload.store || payload;
    applyStore(nextStore);
    return payload;
  };

  const advanceComplaint = async (id) => {
    setBusy(`adv-${id}`, true);
    try {
      await callAndApply(
        `/api/complaints/${id}/advance`,
        { method: "POST" },
        "Advance complaint failed",
      );
      setFeedback({ type: "success", text: "Complaint status advanced." });
    } catch {
      setFeedback({
        type: "error",
        text: "Unable to advance complaint state.",
      });
    } finally {
      setBusy(`adv-${id}`, false);
    }
  };

  const markFalseCompletion = async (technicianId) => {
    setBusy(technicianId, true);
    try {
      await callAndApply(
        `/api/technicians/${technicianId}/penalty`,
        { method: "POST" },
        "Penalty update failed",
      );
      setFeedback({ type: "success", text: "Technician penalty recorded." });
    } catch {
      setFeedback({
        type: "error",
        text: "Unable to apply technician penalty.",
      });
    } finally {
      setBusy(technicianId, false);
    }
  };

  const submitTechnicianWork = async (complaint) => {
    const details = techSubmission[complaint.id] || {};
    if (!details.proofCaptured || !details.scanConfirmed) {
      setFeedback({
        type: "warning",
        text: "Technician must capture proof and scan before submit.",
      });
      return;
    }

    if (!details.afterImageFile) {
      setFeedback({
        type: "warning",
        text: "Please upload after-work image before submit.",
      });
      return;
    }

    setBusy(`tech-${complaint.id}`, true);
    try {
      const formData = new FormData();
      formData.append("proofCaptured", String(details.proofCaptured));
      formData.append("scanConfirmed", String(details.scanConfirmed));
      formData.append("afterImage", details.afterImageFile);

      await callAndApply(
        `/api/complaints/${complaint.id}/technician-submit`,
        { method: "POST", body: formData },
        "Technician submission failed",
      );

      setFeedback({
        type: "success",
        text: "Technician work submitted for AI/backend verification.",
      });
    } catch {
      setFeedback({ type: "error", text: "Technician submission failed." });
    } finally {
      setBusy(`tech-${complaint.id}`, false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <SpotlightBanner
            title="Authority & Admin Dashboard"
            subtitle="Manage complaint states, review technician trust, and validate completion evidence."
          />
          <div className="flex flex-col items-end gap-2">
            <Pill tone="purple">
              {sessionUser?.displayName || "Authority Admin"}
            </Pill>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ReactBitsChip />
          <Pill>Authority workflow</Pill>
          <Pill tone="purple">Technician validation</Pill>
        </div>

        {feedback.text ? (
          <Notice type={feedback.type}>{feedback.text}</Notice>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Local Body Authority Controls
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              Department:
            </span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={authorityFilter}
              onChange={(event) => setAuthorityFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="Roads">Roads</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Utilities">Utilities</option>
              <option value="Sewage">Sewage</option>
            </select>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Complaint</th>
                  <th className="px-2 py-2 font-medium">Reporter</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={4}>
                      Loading complaints...
                    </td>
                  </tr>
                ) : authorityRows.length ? (
                  authorityRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="px-2 py-2">
                        <p className="font-medium text-slate-900">{row.id}</p>
                        <p className="text-slate-600">{row.title}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {row.department || "General"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.reporterName || "Unknown"}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(row.state)}`}
                        >
                          {row.state}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          size="sm"
                          onClick={() => advanceComplaint(row.id)}
                          disabled={busyIds.includes(`adv-${row.id}`)}
                        >
                          Change Status
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={4}>
                      No complaints found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Selected Problem Details
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="min-w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={selectedComplaintId || ""}
              onChange={(event) => setSelectedComplaintId(event.target.value)}
            >
              {complaints.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.id} - {item.title}
                </option>
              ))}
            </select>

            {selectedComplaint ? (
              <Button
                onClick={() => advanceComplaint(selectedComplaint.id)}
                disabled={busyIds.includes(`adv-${selectedComplaint.id}`)}
              >
                Change Status
              </Button>
            ) : null}
          </div>

          {selectedComplaint ? (
            <div className="mt-4 grid gap-2 rounded-md border border-slate-100 p-3 text-sm text-slate-700 md:grid-cols-2">
              <p>
                <span className="font-medium">Complaint ID:</span>{" "}
                {selectedComplaint.id}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(selectedComplaint.state)}`}
                >
                  {selectedComplaint.state}
                </span>
              </p>
              <p>
                <span className="font-medium">User:</span>{" "}
                {selectedComplaint.reporterName || "Unknown"}
              </p>
              <p>
                <span className="font-medium">Location:</span>{" "}
                {selectedComplaint.ward}
              </p>
              <p>
                <span className="font-medium">Type:</span>{" "}
                {selectedComplaint.category}
              </p>
              <p>
                <span className="font-medium">Department:</span>{" "}
                {selectedComplaint.department || "General"}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a complaint.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Manager Trust Controls
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Technician</th>
                  <th className="px-2 py-2 font-medium">Trust</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Penalty</th>
                </tr>
              </thead>
              <tbody>
                {managerRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{row.trust}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${row.assignmentStatus === "Restricted" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                      >
                        {row.assignmentStatus}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markFalseCompletion(row.id)}
                        disabled={busyIds.includes(row.id)}
                      >
                        Penalize
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Technician Panel
          </h3>
          <div className="mt-3">
            <Notice>
              Technician completion workflow: open camera, scan evidence, submit
              for backend AI verification.
            </Notice>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {assignedForTechnicians.length ? (
              assignedForTechnicians.map((complaint) => {
                const details = techSubmission[complaint.id] || {
                  proofCaptured: false,
                  scanConfirmed: false,
                  afterImageFile: null,
                };

                return (
                  <div
                    key={complaint.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {complaint.id} · {complaint.title}
                      </h4>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(complaint.state)}`}
                      >
                        {complaint.state}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700">
                      Assigned Technician: {complaint.assignedTechnicianId}
                    </p>
                    <p className="text-sm text-slate-500">
                      Department: {complaint.department || "General"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        className="w-60 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const selected = event.target.files?.[0] || null;
                          setTechSubmission((current) => ({
                            ...current,
                            [complaint.id]: {
                              ...details,
                              afterImageFile: selected,
                            },
                          }));
                        }}
                      />

                      <Button
                        variant="outline"
                        onClick={() => setCameraOpen(complaint.id)}
                      >
                        <Camera size={16} />
                        {details.afterImageFile
                          ? "Photo Captured"
                          : "Open Camera"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() =>
                          setTechSubmission((current) => ({
                            ...current,
                            [complaint.id]: {
                              ...details,
                              scanConfirmed: !details.scanConfirmed,
                            },
                          }))
                        }
                      >
                        <ScanLine size={16} />
                        {details.scanConfirmed ? "Scanned" : "Scan"}
                      </Button>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {details.afterImageFile
                        ? `After image: ${details.afterImageFile.name}`
                        : "No after-work image selected"}
                    </p>

                    <div className="mt-3">
                      <Button
                        onClick={() => submitTechnicianWork(complaint)}
                        disabled={busyIds.includes(`tech-${complaint.id}`)}
                      >
                        Submit Completion
                      </Button>
                    </div>

                    {complaint.state === "Manager Review" ? (
                      <div className="mt-3">
                        <Notice type="error">
                          <span className="inline-flex items-center gap-1">
                            <ShieldAlert size={14} /> Submission flagged:
                            potential fake/insufficient completion.
                          </span>
                        </Notice>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                No assigned complaints for technicians.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Workflow Alerts
          </h3>
          {logs.length ? (
            <ul className="mt-3 space-y-2">
              {logs.slice(0, 12).map((entry, index) => (
                <li
                  key={`${entry}-${index}`}
                  className="rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-700"
                >
                  {entry}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No alerts yet.</p>
          )}
        </div>

        <CameraModal
          isOpen={cameraOpen !== null}
          onClose={() => setCameraOpen(null)}
          onCapture={(file) => {
            if (cameraOpen !== null) {
              setTechSubmission((current) => ({
                ...current,
                [cameraOpen]: {
                  ...current[cameraOpen],
                  afterImageFile: file,
                },
              }));
            }
          }}
        />
      </section>
    </main>
  );
}
