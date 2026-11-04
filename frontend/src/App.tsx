import { useState } from "react";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { useDashboardData } from "./hooks/useDashboardData";
import { Analytics } from "./pages/Analytics";
import { CameraManagement } from "./pages/CameraManagement";
import { Events } from "./pages/Events";
import { LiveMonitoring } from "./pages/LiveMonitoring";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Settings } from "./pages/Settings";
import type { PageKey } from "./types";
import { setAdminKey } from "./services/api";
import { systemService } from "./services/systemService";
function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [page, setPage] = useState<PageKey>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const data = useDashboardData(authenticated);
  const content =
    page === "overview" ? (
      <Overview
        cameras={data.cameras}
        zones={data.zones}
        events={data.events}
        trend={data.hourly}
        occupancy={data.occupancy}
        loading={data.loading}
        error={data.error}
        socketOnline={data.socketOnline}
        onRefresh={data.refresh}
      />
    ) : page === "monitoring" ? (
      <LiveMonitoring cameras={data.cameras} performance={data.performance} />
    ) : page === "cameras" ? (
      <CameraManagement
        cameras={data.cameras}
        zones={data.zones}
        onRefresh={data.refresh}
        performance={data.performance}
      />
    ) : page === "events" ? (
      <Events events={data.events} loading={data.loading} />
    ) : page === "analytics" ? (
      <Analytics
        zones={data.zones}
        daily={data.daily}
        hourly={data.hourly}
        peaks={data.peaks}
        occupancy={data.occupancy}
      />
    ) : (
      <Settings
        zones={data.zones}
        status={data.status}
        performance={data.performance}
        database={data.database}
      />
    );
  const login = async (key: string) => {
    await systemService.verifyAdmin(key);
    setAuthenticated(true);
  };
  const logout = () => {
    setAdminKey("");
    setAuthenticated(false);
    setPage("overview");
  };
  if (!authenticated) return <Login onSuccess={login} />;
  return (
    <DashboardLayout
      page={page}
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      onNavigate={setPage}
      onCollapse={() => setCollapsed((v) => !v)}
      onMobileOpen={() => setMobileOpen(true)}
      onMobileClose={() => setMobileOpen(false)}
      onLogout={logout}
    >
      {content}
    </DashboardLayout>
  );
}
export default App;
