import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Statistics from "@/pages/Statistics";
import Cards from "@/pages/Cards";
import Settings from "@/pages/Settings";
import Emails from "@/pages/Emails";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="cards" element={<Cards />} />
        <Route path="emails" element={<Emails />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
