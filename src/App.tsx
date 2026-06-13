import { useState, useMemo, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline, Snackbar, Alert, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Statistics from "@/pages/Statistics";
import Cards from "@/pages/Cards";
import CardDetail from "@/pages/Cards/CardDetail";
import Settings from "@/pages/Settings";
import Emails from "@/pages/Emails";
import Templates from "@/pages/Templates";
import { useToastStore } from "@/lib/toast-store";
import { lightTheme, darkTheme } from "@/theme";

function App() {
  const [dark, setDark] = useState(false);
  const theme = useMemo(() => (dark ? darkTheme : lightTheme), [dark]);
  const toggleDark = useCallback(() => setDark((d) => !d), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route element={<Layout dark={dark} onToggleDark={toggleDark} />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="cards" element={<Cards />} />
          <Route path="cards/:id" element={<CardDetail />} />
          <Route path="emails" element={<Emails />} />
          <Route path="templates" element={<Templates />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <ToastSnackbar />
    </ThemeProvider>
  );
}

function ToastSnackbar() {
  const { toasts, remove } = useToastStore();
  const latest = toasts[0];

  return (
    <Snackbar
      open={!!latest}
      autoHideDuration={latest?.duration ?? 3000}
      onClose={() => latest && remove(latest.id)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      {latest ? (
        <Alert
          onClose={() => remove(latest.id)}
          severity={latest.type === "loading" ? "info" : latest.type === "success" ? "success" : "error"}
          variant="filled"
          sx={{ minWidth: 280 }}
          action={
            latest.action ? (
              <IconButton size="small" color="inherit" onClick={latest.action.onClick}>
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : undefined
          }
        >
          {latest.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}

export default App;
