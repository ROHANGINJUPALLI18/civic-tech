"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!payload?.authenticated || !payload?.user?.role) return;
        window.location.href =
          payload.user.role === "admin" ? "/admin" : "/user";
      } catch {
        // stay on login
      }
    };

    checkSession();
  }, []);

  const onLogin = async () => {
    if (!username.trim() || !password) {
      setFeedback({ type: "error", text: "Enter username and password." });
      return;
    }

    setBusy(true);
    setFeedback({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Login failed");
      }

      window.location.href =
        payload?.user?.role === "admin" ? "/admin" : "/user";
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Invalid login." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: { xs: 4, md: 8 },
        px: 2,
        bgcolor: "#F7F8F0",
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(156, 213, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(156, 213, 255, 0.12) 0%, transparent 50%)
        `,
      }}
    >
      <Card
        elevation={3}
        sx={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 5,
          bgcolor: "background.paper",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
          },
        }}
      >
        <CardContent sx={{ p: { xs: 4, md: 5 } }}>
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography 
                variant="h4" 
                color="text.primary" 
                fontWeight={700}
                sx={{ mb: 1 }}
              >
                Welcome Back
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to access your dashboard
              </Typography>
            </Box>

            <TextField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2.5,
                  bgcolor: "#FAFBFC",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: "#F7F9FB",
                  },
                  "&.Mui-focused": {
                    bgcolor: "background.paper",
                  },
                },
              }}
            />

            <TextField
              type="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onLogin();
              }}
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2.5,
                  bgcolor: "#FAFBFC",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: "#F7F9FB",
                  },
                  "&.Mui-focused": {
                    bgcolor: "background.paper",
                  },
                },
              }}
            />

            {feedback.text ? (
              <Alert severity={feedback.type === "error" ? "error" : "success"}>
                {feedback.text}
              </Alert>
            ) : null}

            <Button
              onClick={onLogin}
              disabled={busy}
              fullWidth
              sx={{
                mt: 1,
                py: 1.5,
                borderRadius: 2.5,
                bgcolor: "primary.main",
                color: "common.white",
                fontSize: "1rem",
                fontWeight: 600,
                textTransform: "none",
                boxShadow: "0 4px 12px rgba(156, 213, 255, 0.3)",
                transition: "all 0.2s ease",
                "&:hover": { 
                  bgcolor: "primary.dark",
                  boxShadow: "0 6px 16px rgba(156, 213, 255, 0.4)",
                  transform: "translateY(-1px)",
                },
                "&:disabled": {
                  bgcolor: "action.disabledBackground",
                  color: "action.disabled",
                  boxShadow: "none",
                },
              }}
            >
              {busy ? "Signing in..." : "Login"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
