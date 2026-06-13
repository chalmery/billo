import { createTheme } from "@mui/material/styles";

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3b82f6" },
    secondary: { main: "#64748b" },
    error: { main: "#dc2626" },
    warning: { main: "#d97706" },
    success: { main: "#16a34a" },
    background: { default: "#ffffff", paper: "#ffffff" },
    divider: "#e2e8f0",
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 500 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: "#64748b", fontSize: "0.75rem" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#3b82f6" },
    secondary: { main: "#94a3b8" },
    error: { main: "#ef4444" },
    warning: { main: "#f59e0b" },
    success: { main: "#22c55e" },
    background: { default: "#0f172a", paper: "#1e293b" },
    divider: "#334155",
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 500 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: "#94a3b8", fontSize: "0.75rem" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});
