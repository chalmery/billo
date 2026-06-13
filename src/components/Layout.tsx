import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  List,
  BarChart3,
  CreditCard,
  Mail,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/", label: "首页", icon: LayoutDashboard },
  { to: "/transactions", label: "交易明细", icon: List },
  { to: "/statistics", label: "统计分析", icon: BarChart3 },
  { to: "/cards", label: "卡片管理", icon: CreditCard },
  { to: "/emails", label: "邮件管理", icon: Mail },
  { to: "/settings", label: "设置", icon: Settings },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <h1 className="text-xl font-bold text-primary">Billo</h1>
          <p className="text-xs text-muted-foreground mt-0.5">信用卡账单统计</p>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          Billo v0.1.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}