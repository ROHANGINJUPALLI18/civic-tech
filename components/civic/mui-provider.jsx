"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#9CD5FF",
      dark: "#6EB8F2",
      light: "#C4E4FF",
    },
    secondary: {
      main: "#1c1d1f",
    },
    background: {
      default: "#f7f9fa",
      paper: "#ffffff",
    },
    text: {
      primary: "#1c1d1f",
      secondary: "#4d4f56",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          borderRadius: 8,
          paddingInline: 16,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
        },
      },
    },
  },
});

export function MuiProvider({ children }) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
