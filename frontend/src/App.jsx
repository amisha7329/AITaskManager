import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import { AuthProvider } from "./context/AuthContext";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#0a0a23", paper: "#161629" },
    text: { primary: "#ffffff", secondary: "#b3b3cc" },
  },
  typography: { fontFamily: "Poppins, sans-serif" },
});

const App = () => {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
