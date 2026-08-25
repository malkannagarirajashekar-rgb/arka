import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import RolePlaceholder from "./pages/RolePlaceholder";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/tenant" element={<RolePlaceholder role="tenant_admin" />} />
      <Route path="/app" element={<RolePlaceholder role="tenant_user" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
