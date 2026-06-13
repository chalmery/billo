import { NavLink, Outlet } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  IconButton,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptIcon from "@mui/icons-material/Receipt";
import BarChartIcon from "@mui/icons-material/BarChart";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import MailIcon from "@mui/icons-material/Mail";
import SettingsIcon from "@mui/icons-material/Settings";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

const DRAWER_WIDTH = 220;

const navItems = [
  { to: "/", label: "首页", icon: DashboardIcon },
  { to: "/transactions", label: "交易明细", icon: ReceiptIcon },
  { to: "/statistics", label: "统计分析", icon: BarChartIcon },
  { to: "/cards", label: "卡片管理", icon: CreditCardIcon },
  { to: "/emails", label: "邮件管理", icon: MailIcon },
  { to: "/templates", label: "邮件模板", icon: ArticleOutlinedIcon },
  { to: "/settings", label: "设置", icon: SettingsIcon },
];

export default function Layout({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            borderRight: 1,
            borderColor: "divider",
          },
        }}
      >
        <Box sx={{ px: 2.5, py: 2.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }} color="primary">
            Billo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            信用卡账单统计
          </Typography>
        </Box>

        <List dense sx={{ flex: 1, py: 1 }}>
          {navItems.map((item) => (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.to}
                end={item.to === "/"}
                sx={{
                  mx: 1,
                  borderRadius: 1.5,
                  "&.active": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": { bgcolor: "primary.dark" },
                    "& .MuiListItemIcon-root": { color: "primary.contrastText" },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <item.icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.label} sx={{ "& .MuiListItemText-primary": { fontSize: 14 } }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">
            Billo v0.1.0
          </Typography>
          <IconButton size="small" onClick={onToggleDark}>
            {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, overflow: "auto" }}>
        <Box sx={{ maxWidth: 1100, mx: "auto", p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
