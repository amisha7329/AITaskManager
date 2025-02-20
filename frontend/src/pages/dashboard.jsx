import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { TextField, Button, IconButton, DialogActions, DialogContent, DialogTitle, Dialog} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
// import CheckIcon from "@mui/icons-material/Check";
import EditIcon from '@mui/icons-material/Edit';
import { io } from "socket.io-client"; 
import { Checkbox, FormControlLabel } from "@mui/material"; 
import { Avatar, Badge, Box, Card, CardContent, Fab, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from '@mui/icons-material/Logout';

const Dashboard = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [editTask, setEditTask] = useState(null); 
  const [editOpen, setEditOpen] = useState(false); 
  const [open, setOpen] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromURL = urlParams.get("token");
    const userEncoded = urlParams.get("user");

    console.log("user", user)

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

    fetchTasks();

    const socket = io("http://127.0.0.1:8000", { transports: ["websocket"] });

    
    socket.on("task_created", (data) => {
      console.log("WebSocket: New task added", data.task);
      setTasks((prevTasks) => [...prevTasks, data.task]); 
    });

  
    socket.on("task_deleted", ({ task_id }) => {
      console.log("WebSocket: Task deleted", task_id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== task_id));
    });

   
    socket.on("task_updated", (data) => {
      console.log("WebSocket: Task updated", data.task);
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === data.task.id ? data.task : task))
      );
    });

    return () => {
      socket.disconnect(); 
    };
  }, [token, navigate, login]);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/tasks/?token=${localStorage.getItem("token")}`);
      setTasks(res.data.tasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title || !newTask.description) return;
  
    try {
      await axios.post(
        `http://127.0.0.1:8000/tasks/?token=${localStorage.getItem("token")}`,
        { title: newTask.title, description: newTask.description },
        { headers: { "Content-Type": "application/json" } }
      );
  
      setNewTask({ title: "", description: "" }); 
      setOpen(false);
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };
  

  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`http://127.0.0.1:8000/tasks/${taskId}?token=${localStorage.getItem("token")}`);
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleEditTaskClick = (task) => {
  setEditTask(task);
  setEditOpen(true);
};

const handleEditTaskSubmit = async () => {
  try {
    await axios.put(
      `http://127.0.0.1:8000/tasks/${editTask.id}?token=${localStorage.getItem("token")}`,
      { 
        title: editTask.title, 
        description: editTask.description, 
        completed: editTask.completed 
      },
      { headers: { "Content-Type": "application/json" } }
    );

    setEditOpen(false); 
  } catch (err) {
    console.error("Error updating task:", err);
  }
};


  return (
    <Box sx={{ p: 3, backgroundColor: "black", minHeight: "100vh", color: "white" }}>
      
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar src={user?.picture} alt={user?.name} sx={{height:"50px", width:"50px"}} />
          <Typography textTransform="capitalize" fontSize={32}>Welcome, {user?.name}!</Typography>
        </Stack>
        <LogoutIcon sx={{height:"50px", width:"50px"}} onClick={logout}>
          Logout
        </LogoutIcon>
      </Stack>

      {/* Tasks */}
      <Stack spacing={2}>
        {tasks.map((task) => (
          <Card
          key={task.id}
          sx={{
            border: task.completed
              ? "2px solid #00FF7F" // ✅ Soft Neon Green for Completed
              : "2px solid #FF3131", // ✅ Soft Neon Red for Incomplete
            backgroundColor: "rgba(255, 255, 255, 0.03)", // ✅ Subtle depth effect
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            borderRadius: "18px", // ✅ More rounded for premium look
            boxShadow: task.completed
              ? "0px 0px 10px rgba(0, 255, 127, 0.6)" // ✅ Soft Neon Glow for Green
              : "0px 0px 10px rgba(255, 49, 49, 0.6)", // ✅ Soft Neon Glow for Red
            transition: "0.3s",
            "&:hover": {
              boxShadow: task.completed
                ? "0px 0px 18px rgba(0, 255, 127, 1)" // ✅ Stronger glow on hover
                : "0px 0px 18px rgba(255, 49, 49, 1)",
              transform: "scale(1.02)", // ✅ Slight hover lift effect
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
      letterSpacing: "0.5px",
      opacity: 0.9,
    }}
  >
    {task.description}
  </Typography>
</CardContent>


            {/* Badge for Tag */}
            {task.tags && (
              <Badge
      sx={{
        backgroundColor: "black",
        border: "1px solid #00e676",
        color: "#00e676",
        p: "6px 12px",
        borderRadius: "16px",
        fontSize: "14px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.8px",
        boxShadow: "0px 0px 5px #00E623", // ✅ Soft glow effect
      }}
    >
                {task.tags}
              </Badge>
            )}

            
            {/* <Badge
              sx={{
                backgroundColor: task.completed ? "#388E3C" : "#D32F2F",
                color: "white",
                p: "4px 10px",
                borderRadius: "16px",
                fontSize: "12px",
                ml: 2,
              }}
            >
              {task.completed ? "Complete" : "Incomplete"}
            </Badge> */}

            
            <Stack direction="row" spacing={1} ml={2}>
              <IconButton onClick={() => handleEditTaskClick(task)} color="primary">
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => handleDeleteTask(task.id)} color="error">
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
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          />
          <TextField
            placeholder="Description"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            style={{ width: "100%", padding: 8, marginBottom: 10, minHeight: 60 }}
          />
         

          <DialogActions>
      <Button onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleAddTask} color="primary">Add</Button>
    </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
    <DialogTitle>Edit Task</DialogTitle>

<DialogContent>
  <TextField
    label="Title"
    fullWidth
    margin="dense"
    value={editTask?.title || ""}
    onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
  />
  <TextField
    label="Description"
    fullWidth
    margin="dense"
    value={editTask?.description || ""}
    onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
  />

  
  <FormControlLabel
    control={
      <Checkbox
        checked={editTask?.completed || false}
        onChange={(e) => setEditTask({ ...editTask, completed: e.target.checked })}
      />
    }
    label={editTask?.completed ? "Complete" : " Incomplete"}
  />
</DialogContent>

    <DialogActions>
      <Button onClick={() => setEditOpen(false)}>Cancel</Button>
      <Button onClick={handleEditTaskSubmit} color="primary">Save</Button>
    </DialogActions>
  </Dialog>

    </Box>
  
  );
};

export default Dashboard;
