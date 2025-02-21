import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  IconButton,
  DialogActions,
  Dialog,
  Snackbar,
  Alert,
  Avatar,
  Badge,
  Box,
  Card,
  CardContent,
  Fab,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteIcon from "@mui/icons-material/Delete";

const Dashboard = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [open, setOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  const token = localStorage.getItem("token");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromURL = urlParams.get("token");
    const userEncoded = urlParams.get("user");

    if (tokenFromURL && userEncoded) {
      try {
        const userDecoded = JSON.parse(decodeURIComponent(userEncoded));
        localStorage.setItem("token", tokenFromURL);
        localStorage.setItem("user", JSON.stringify(userDecoded));
        login(userDecoded, tokenFromURL);
        navigate("/dashboard", { replace: true });
      } catch (error) {
        console.error("Error decoding user JSON:", error);
        navigate("/");
      }
    }

    if (!token && !tokenFromURL) {
      navigate("/");
      return;
    }

    const newSocket = new WebSocket("wss://ami.polotrax.com/ws");

    setSocket(newSocket);

    newSocket.onopen = () => {
      console.log("WebSocket Connected");

      setTimeout(() => {
        newSocket.send(JSON.stringify({ action: "get_tasks", token }));
      }, 500);
    };

    newSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // console.log("received", data);

      if (data.event === "task_list") {
        // console.log("task list received", data.tasks);
        setTasks(data.tasks);
      }
      if (data.event === "task_created") {
        // console.log("new task received", data.task);
        setTasks((prevTasks) => [...prevTasks, data.task]);
      }
      if (data.event === "task_deleted") {
        // console.log("task deleted", data.task_id);
        setTasks((prevTasks) =>
          prevTasks.filter((task) => task.id !== data.task_id)
        );
      }
    };

    newSocket.onerror = (error) => {
      console.error("⚠ WebSocket Error:", error);
    };

    newSocket.onclose = () => {
      console.log("WebSocket Disconnected");
    };

    return () => newSocket.close();
  }, [token, navigate]);

  const handleAddTask = () => {
    if (!newTask.title || !newTask.description || !socket) return;

    const taskData = {
      action: "add_task",
      token: token,
      task: { title: newTask.title, description: newTask.description },
    };

    socket.send(JSON.stringify(taskData));

    setOpen(false);
    setNewTask({ title: "", description: "" });

    // success notify
    setSnackbarMessage("Task added successfully!");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  };

  const handleDeleteTask = (taskId) => {
    if (!socket) return;

    socket.send(
      JSON.stringify({
        action: "delete_task",
        token: token,
        task_id: taskId,
      })
    );

    // delete notify
    setSnackbarMessage("Task deleted successfully!");
    setSnackbarSeverity("error");
    setSnackbarOpen(true);
  };

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: "black",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar
            src={user?.picture}
            alt={user?.name}
            sx={{ height: "50px", width: "50px" }}
          />
          <Typography textTransform="capitalize" fontSize={32}>
            Welcome, {user?.name}!
          </Typography>
        </Stack>
        <LogoutIcon sx={{ height: "50px", width: "50px" }} onClick={logout}>
          Logout
        </LogoutIcon>
      </Stack>

      {/* Task List */}
      <Stack spacing={2}>
        {tasks.map((task) => (
          <Card
            key={task.id}
            sx={{
              border: "2px solid rgb(128, 0, 255)",
              backgroundColor: "rgba(21, 7, 31, 0.55)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              borderRadius: "18px",
              transition: "0.3s",
              "&:hover": {
                transform: "scale(1.02)",
              },
            }}
          >
            <CardContent sx={{ flex: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: "600",
                  color: "#F8F8F8",
                  letterSpacing: "0.8px",
                  textTransform: "capitalize",
                }}
              >
                {task.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: "400",
                  fontStyle: "italic",
                  color: "#B3B3B3",
                  opacity: 0.9,
                }}
              >
                {task.description}
              </Typography>
            </CardContent>

            {task.tags && (
              <Badge
                sx={{
                  backgroundColor: "black",
                  border: "2px solid rgb(20, 243, 224)",
                  color: "rgb(20, 243, 224)",
                  p: "6px 12px",
                  borderRadius: "16px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                {task.tags}
              </Badge>
            )}

            <Stack direction="row" spacing={1} ml={2}>
              <IconButton
                onClick={() => handleDeleteTask(task.id)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Fab
        color="primary"
        sx={{ position: "fixed", bottom: 36, right: 36 }}
        onClick={() => setOpen(true)}
      >
        <AddIcon />
      </Fab>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <Box sx={{ p: 3, width: 400, backgroundColor: "#333", color: "white" }}>
          <Typography variant="h6" gutterBottom>
            Add New Task
          </Typography>
          <TextField
            type="text"
            placeholder="Title"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <TextField
            placeholder="Description"
            value={newTask.description}
            onChange={(e) =>
              setNewTask({ ...newTask, description: e.target.value })
            }
            style={{ width: "100%", marginBottom: 10, minHeight: 60 }}
          />
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTask} color="primary">
              Add
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;
