import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#8e24aa", 
    },
    secondary: {
      main: "#ff4081", 
    },
    background: {
      default: "#121212", 
      paper: "#1e1e1e",
    },
    text: {
      primary: "#ffffff",
      secondary: "#b0bec5",
    },
  },
  typography: {
    fontFamily: "Poppins, sans-serif",
  },
});

export default darkTheme;
