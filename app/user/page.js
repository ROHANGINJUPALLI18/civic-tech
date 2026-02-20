"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PlusCircle,
  Camera,
  ShieldCheck,
  Trophy,
  UserCheck,
} from "lucide-react";

import { SpotlightBanner } from "@/components/civic/spotlight-banner";
import { ReactBitsChip } from "@/components/civic/reactbits-chip";
import { Button } from "@/components/ui/button";
import { CameraModal } from "@/components/civic/camera-modal";
import { ImageModal } from "@/components/civic/image-modal";
import { COMPLAINT_STATES, computeSlaRisk } from "@/lib/workflow";

const CATEGORY_OPTIONS = [
  "Pothole",
  "Garbage",
  "Streetlight",
  "Drainage",
  "Sewage Overflow",
];

const FALLBACK_COORDINATES = {
  latitude: 28.6138,
  longitude: 77.209,
};

const STATE_BADGE = {
  Reported: "bg-slate-100 text-slate-700",
  "Pre-Validation": "bg-indigo-100 text-indigo-700",
  Assigned: "bg-cyan-100 text-cyan-700",
  "In Progress": "bg-lime-100 text-lime-700",
  "Work Uploaded": "bg-sky-100 text-sky-700",
  "User Confirmation": "bg-fuchsia-100 text-fuchsia-700",
  Closed: "bg-emerald-100 text-emerald-700",
};

function badgeClass(state) {
  return STATE_BADGE[state] || "bg-slate-100 text-slate-700";
}

function displayStateLabel(state) {
  const normalizedState = String(state || "").replace(/^AI\s+/, "");
  if (normalizedState === "User Confirmation")
    return "waiting for user confirmation";
  return normalizedState;
}

function getProgressPercent(state) {
  const position = COMPLAINT_STATES.findIndex((step) => step === state);
  return Math.max(
    0,
    Math.round(((position + 1) / COMPLAINT_STATES.length) * 100),
  );
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

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function UserDashboardPage() {
  const [complaints, setComplaints] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const [sessionUser, setSessionUser] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const [newComplaint, setNewComplaint] = useState({
    reporterName: "",
    title: "",
    description: "",
    category: "Pothole",
    ward: "Ward 12",
    complaintImageFile: null,
    complaintImageCapturedAt: "",
    complaintImageCoordinates: null,
  });

  const [reviewRatings, setReviewRatings] = useState({});
  const [showCamera, setShowCamera] = useState(false);
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    title: "",
    src: "",
  });

  const setBusy = (id, value) => {
    setBusyIds((current) => {
      if (value && !current.includes(id)) return [...current, id];
      if (!value) return current.filter((item) => item !== id);
      return current;
    });
  };

  const toImageUrl = (relativePath) => {
    if (!relativePath) return "";
    return `/api/images/${relativePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
  };

  const openImageModal = (title, relativePath) => {
    const src = toImageUrl(relativePath);
    if (!src) return;
    setImageModal({ isOpen: true, title, src });
  };

  const applyStore = (store) => {
    setComplaints(store.complaints ?? []);
    setLogs(store.logs ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [bootstrapResponse, sessionResponse] = await Promise.all([
          fetch("/api/bootstrap", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);

        if (!bootstrapResponse.ok) {
          throw new Error("Failed to load server state");
        }

        if (sessionResponse.ok) {
          const sessionPayload = await sessionResponse.json();
          setSessionUser(sessionPayload.user ?? null);
        }

        const store = await bootstrapResponse.json();
        applyStore(store);
      } catch {
        setFeedback({ type: "error", text: "Unable to load server state." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const closed = complaints.filter((item) => item.state === "Closed").length;
    const active = complaints.length - closed;
    const awaitingUserConfirmation = complaints.filter(
      (item) => item.state === "User Confirmation",
    ).length;
    const atRisk = complaints.filter(
      (item) => computeSlaRisk(item) !== "healthy",
    ).length;
    return { closed, active, awaitingUserConfirmation, atRisk };
  }, [complaints]);

  const communityLeaderboard = useMemo(() => {
    const map = complaints.reduce((acc, item) => {
      const score = (acc[item.ward] ?? 0) + (item.communityWeight || 1);
      acc[item.ward] = score;
      return acc;
    }, {});

    return Object.entries(map)
      .map(([community, score]) => ({ community, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [complaints]);

  const callAndApply = async (url, options = {}, fallbackMessage) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      let message = fallbackMessage || "Request failed";
      try {
        const payload = await response.json();
        if (payload?.message) {
          message = payload.message;
        }
      } catch {
        try {
          const text = await response.text();
          if (text?.trim()) {
            message = text;
          }
        } catch {
          message = fallbackMessage || "Request failed";
        }
      }
      throw new Error(message);
    }
    const payload = await response.json();
    const nextStore = payload.store || payload;
    applyStore(nextStore);
    return payload;
  };

  const hasValidCoordinates = (coords) =>
    Number.isFinite(coords?.latitude) && Number.isFinite(coords?.longitude);

  const getCurrentPosition = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({
          coordinates: null,
          error: "Geolocation is not supported in this browser.",
        });
        return;
      }

      const options = [
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
      ];

      const readPosition = (index = 0) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coordinates: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMeters: position.coords.accuracy,
              },
              error: null,
            });
          },
          (error) => {
            if (index + 1 < options.length) {
              readPosition(index + 1);
              return;
            }

            const errorMessage =
              error?.code === 1
                ? "Location permission denied."
                : error?.code === 2
                  ? "Location unavailable."
                  : error?.code === 3
                    ? "Location request timed out."
                    : "Unable to read location.";

            resolve({ coordinates: null, error: errorMessage });
          },
          options[index],
        );
      };

      readPosition(0);
    });

  const createComplaint = async () => {
    if (
      !newComplaint.reporterName.trim() ||
      !newComplaint.title.trim() ||
      !newComplaint.description.trim()
    ) {
      setFeedback({
        type: "warning",
        text: "Please fill reporter name, title, and description.",
      });
      return;
    }

    if (!newComplaint.complaintImageFile) {
      setFeedback({
        type: "warning",
        text: "Please upload a complaint image before submit.",
      });
      return;
    }

    setBusy("new", true);
    setFeedback({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("reporterName", newComplaint.reporterName);
      formData.append("title", newComplaint.title);
      formData.append("description", newComplaint.description);
      formData.append("category", newComplaint.category);
      formData.append("ward", newComplaint.ward);

      formData.append("complaintImage", newComplaint.complaintImageFile);
      if (newComplaint.complaintImageCapturedAt) {
        formData.append(
          "complaintImageCapturedAt",
          newComplaint.complaintImageCapturedAt,
        );
      }

      let complaintCoords = hasValidCoordinates(
        newComplaint.complaintImageCoordinates,
      )
        ? newComplaint.complaintImageCoordinates
        : null;

      let geoError = null;
      if (!complaintCoords) {
        const result = await getCurrentPosition();
        complaintCoords = result.coordinates;
        geoError = result.error;
      }

      if (!hasValidCoordinates(complaintCoords)) {
        const permissionDenied =
          typeof geoError === "string" && geoError.includes("denied");

        if (permissionDenied) {
          throw new Error(
            "Location permission denied. Please enable location access and try again.",
          );
        }

        complaintCoords = FALLBACK_COORDINATES;
        setFeedback({
          type: "warning",
          text: "Live location unavailable, using fallback coordinates for this test submission.",
        });
      }

      if (hasValidCoordinates(complaintCoords)) {
        formData.append("latitude", String(complaintCoords.latitude));
        formData.append("longitude", String(complaintCoords.longitude));
      }

      if (!hasValidCoordinates(newComplaint.complaintImageCoordinates)) {
        setNewComplaint((current) => ({
          ...current,
          complaintImageCoordinates: complaintCoords,
        }));
      }

      const payload = await callAndApply(
        "/api/complaints",
        { method: "POST", body: formData },
        "Create complaint failed",
      );

      setNewComplaint((current) => ({
        ...current,
        title: "",
        description: "",
        complaintImageFile: null,
        complaintImageCapturedAt: "",
        complaintImageCoordinates: null,
      }));

      setFeedback({
        type: "success",
        text: "Complaint submitted successfully.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Failed to submit complaint.",
      });
    } finally {
      setBusy("new", false);
    }
  };

  const reviewComplaint = async (complaintId, accepted) => {
    const rating = reviewRatings[complaintId] || (accepted ? 5 : 1);
    setBusy(`rev-${complaintId}`, true);

    try {
      await callAndApply(
        `/api/complaints/${complaintId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted, rating }),
        },
        "Review update failed",
      );

      setFeedback({
        type: "success",
        text: accepted
          ? "Review submitted. Complaint closed with trust update."
          : "Dispute raised. Complaint returned to in-progress.",
      });
    } catch {
      setFeedback({ type: "error", text: "Unable to submit review." });
    } finally {
      setBusy(`rev-${complaintId}`, false);
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
            title="Citizen Dashboard"
            subtitle="Submit complaints, track progress, and review completed work."
          />
          <div className="flex flex-col items-end gap-2">
            <Pill>{sessionUser?.displayName || "Citizen User"}</Pill>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ReactBitsChip />
          <Pill>User workflow</Pill>
          <Pill tone="purple">Complaint tracking</Pill>
        </div>

        {feedback.text ? (
          <Notice type={feedback.type}>{feedback.text}</Notice>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Active Complaints"
            value={stats.active}
            icon={<ShieldCheck size={16} className="text-slate-500" />}
          />
          <StatCard
            title="Closed"
            value={stats.closed}
            icon={<UserCheck size={16} className="text-slate-500" />}
          />
          <StatCard
            title="Awaiting Confirmation"
            value={stats.awaitingUserConfirmation}
          />
          <StatCard title="SLA At Risk" value={stats.atRisk} />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Submit Complaint
            </h3>
            <div className="space-y-2">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
                placeholder="Your name"
                value={newComplaint.reporterName}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    reporterName: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
                placeholder="Issue title"
                value={newComplaint.title}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
                rows={3}
                placeholder="Describe the problem"
                value={newComplaint.description}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
                value={newComplaint.category}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
                placeholder="Ward"
                value={newComplaint.ward}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    ward: event.target.value,
                  }))
                }
              />

              <Button
                variant="outline"
                onClick={() => setShowCamera(true)}
                className="w-full"
              >
                <Camera size={16} /> Take Photo with Camera
              </Button>

              <p className="text-xs text-slate-500">
                {newComplaint.complaintImageFile
                  ? `📷 Photo captured: ${newComplaint.complaintImageFile.name}`
                  : "No photo captured yet"}
              </p>
              {newComplaint.complaintImageCoordinates ? (
                <p className="text-xs text-slate-500">
                  📍 {newComplaint.complaintImageCoordinates.latitude.toFixed(5)}, {" "}
                  {newComplaint.complaintImageCoordinates.longitude.toFixed(5)}
                </p>
              ) : null}

              <Button
                onClick={createComplaint}
                disabled={busyIds.includes("new")}
                className="w-full"
              >
                <PlusCircle size={16} /> Submit Complaint
              </Button>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Complaints by User (Tracking)
            </h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading complaints...</p>
            ) : complaints.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Complaint</th>
                      <th className="px-2 py-2 font-medium">State</th>
                      <th className="px-2 py-2 font-medium">Progress</th>
                      <th className="px-2 py-2 font-medium">SLA</th>
                      <th className="px-2 py-2 font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map((row) => {
                      const canReview = ["User Confirmation"].includes(
                        row.state,
                      );
                      const risk = computeSlaRisk(row);
                      return (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-2 py-2">
                            <p className="font-medium text-slate-900">
                              {row.id}
                            </p>
                            <p className="text-slate-600">{row.title}</p>
                            <p className="text-xs text-slate-500">
                              {row.category}
                            </p>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(row.state)}`}
                            >
                              {displayStateLabel(row.state)}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="w-36 rounded-full bg-slate-100">
                              <div
                                className="rounded-full bg-slate-700 px-2 py-1 text-right text-[10px] font-medium text-white"
                                style={{
                                  width: `${getProgressPercent(row.state)}%`,
                                }}
                              >
                                {getProgressPercent(row.state)}%
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${risk === "breach" ? "bg-red-100 text-red-700" : risk === "warning" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}
                            >
                              {risk === "breach"
                                ? "Breach Risk"
                                : risk === "warning"
                                  ? "Warning"
                                  : "Healthy"}
                            </span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {row.imagePath ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openImageModal(
                                      `${row.id} - Reported Problem`,
                                      row.imagePath,
                                    )
                                  }
                                >
                                  View Problem Image
                                </Button>
                              ) : null}
                              {row.afterEvidence?.imagePath ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openImageModal(
                                      `${row.id} - Completed Work`,
                                      row.afterEvidence.imagePath,
                                    )
                                  }
                                >
                                  View Completed Image
                                </Button>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            {canReview ? (
                              <div className="space-y-2">
                                <select
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                                  value={reviewRatings[row.id] || 5}
                                  onChange={(event) =>
                                    setReviewRatings((current) => ({
                                      ...current,
                                      [row.id]: Number(event.target.value),
                                    }))
                                  }
                                >
                                  {[1, 2, 3, 4, 5].map((item) => (
                                    <option value={item} key={item}>
                                      {item}/5
                                    </option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      reviewComplaint(row.id, true)
                                    }
                                    disabled={busyIds.includes(`rev-${row.id}`)}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      reviewComplaint(row.id, false)
                                    }
                                    disabled={busyIds.includes(`rev-${row.id}`)}
                                  >
                                    Dispute
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Waiting
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No complaints yet.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Community Leaderboard
            </h3>
            {communityLeaderboard.length ? (
              <ul className="space-y-2">
                {communityLeaderboard.map((item, index) => (
                  <li
                    key={item.community}
                    className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <Trophy size={14} /> {index + 1}. {item.community}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      Score {item.score}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No community data yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Workflow Alerts
            </h3>
            {logs.length ? (
              <ul className="space-y-2">
                {logs.slice(0, 8).map((entry, index) => (
                  <li
                    key={`${entry}-${index}`}
                    className="rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-700"
                  >
                    {entry}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No alerts yet.</p>
            )}
          </div>
        </div>
        <CameraModal
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={(file, meta) =>
            setNewComplaint((current) => ({
              ...current,
              complaintImageFile: file,
              complaintImageCapturedAt:
                meta?.capturedAt || new Date().toISOString(),
              complaintImageCoordinates: meta?.coordinates || null,
            }))
          }
        />
        <ImageModal
          isOpen={imageModal.isOpen}
          title={imageModal.title}
          src={imageModal.src}
          onClose={() =>
            setImageModal({ isOpen: false, title: "", src: "" })
          }
        />
      </section>
    </main>
  );
}
