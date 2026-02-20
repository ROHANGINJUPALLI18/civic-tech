import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CameraModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError(
          "Camera permission denied. Please allow camera access in your browser permissions and try again.",
        );
      } else if (err.name === "NotFoundError") {
        setError(
          "No camera device found. Make sure a camera is connected to your device.",
        );
      } else if (err.name === "NotSupportedError") {
        setError("Camera access not supported in your browser. Use Chrome or Firefox.");
      } else {
        setError(err.message || "Unable to access camera. Check permissions.");
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      setStreaming(false);
    }
  };

  const readCurrentPosition = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      );
    });

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], "camera-capture.jpg", {
            type: "image/jpeg",
          });
          const capturedAt = new Date().toISOString();
          const coordinates = await readCurrentPosition();
          onCapture(file, {
            capturedAt,
            coordinates,
          });
          stopCamera();
          onClose();
        }
      }, "image/jpeg");
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="rounded-lg bg-white p-4 shadow-lg w-96">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900">Camera</h3>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-3 space-y-2">
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 font-medium">
              ⚠️ {error}
            </div>
            <button
              onClick={startCamera}
              className="w-full rounded-md bg-red-100 hover:bg-red-200 px-3 py-2 text-sm text-red-700 font-medium transition"
            >
              Try Again
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full rounded-md bg-slate-900 mb-3"
          style={{ height: "300px", objectFit: "cover" }}
        />

        <div className="flex gap-2">
          {!streaming ? (
            <Button onClick={startCamera} className="flex-1">
              Start Camera
            </Button>
          ) : (
            <>
              <Button onClick={capturePhoto} className="flex-1">
                Capture Photo
              </Button>
              <Button onClick={stopCamera} variant="outline" className="flex-1">
                Stop
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
