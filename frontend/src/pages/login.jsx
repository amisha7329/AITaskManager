import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

const Login = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    window.location.href = "https://ami.polotrax.com/auth/login";
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#0D0D0D",
        color: "white",
        textAlign: "center",
      }}
    >
      <Typography
        variant="h4"
        sx={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: "600",
          letterSpacing: "1px",
          mb: 3,
        }}
      >
        Sign in to Task Manager
      </Typography>

      <Button
        onClick={handleLogin}
        variant="contained"
        sx={{
          backgroundColor: "#4285F4",
          color: "white",
          fontWeight: "bold",
          px: 4,
          py: 1.5,
          borderRadius: "25px",
          fontSize: "16px",
          textTransform: "none",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          "&:hover": {
            backgroundColor: "#357ae8",
          },
        }}
      >
        <GoogleIcon /> Sign in with Google
      </Button>
    </Box>
  );
};

export default Login;
