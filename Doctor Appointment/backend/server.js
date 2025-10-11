const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Enhanced middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "your-enhanced-secret-key-change-in-production";
const SALT_ROUNDS = 12;

// Enhanced data storage (in production, use a real database)
const DATA_FILE = "data.json";

// Initialize data storage
function initializeData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      doctors: [
        {
          id: 1,
          name: "Dr. Alice Smith",
          specialty: "Cardiologist",
          image:
            "https://storage.googleapis.com/a1aa/image/4f01e17c-c144-4a95-1f78-b36116685610.jpg",
          description:
            "Expert in heart health and cardiovascular diseases with 10 years of experience.",
          experience: "10 years",
          rating: 4.9,
          available: true,
          schedule: ["09:00", "10:00", "11:00", "14:00", "15:00"],
        },
        {
          id: 2,
          name: "Dr. John Doe",
          specialty: "Pediatrician",
          image:
            "https://storage.googleapis.com/a1aa/image/a89d38ec-1627-4fad-af2d-83f5c3da1f1a.jpg",
          description:
            "Caring for children's health and wellness with over 8 years of pediatric experience.",
          experience: "8 years",
          rating: 4.8,
          available: true,
          schedule: ["10:00", "11:00", "12:00", "15:00", "16:00"],
        },
        {
          id: 3,
          name: "Dr. Maria Lopez",
          specialty: "Dermatologist",
          image:
            "https://storage.googleapis.com/a1aa/image/ee0515b6-c7f7-4a52-b415-d40909f4a292.jpg",
          description:
            "Specialist in skin care and treatment with 12 years of clinical experience.",
          experience: "12 years",
          rating: 4.9,
          available: true,
        },
        {
          id: 4,
          name: "Dr. David Nguyen",
          specialty: "Neurologist",
          image:
            "https://storage.googleapis.com/a1aa/image/9f3f63d3-7840-4fae-3699-1cfc387017a3.jpg",
          description:
            "Experienced neurologist focusing on brain and nervous system disorders.",
          experience: "15 years",
          rating: 4.7,
          available: true,
        },
        {
          id: 5,
          name: "Dr. Emma Johnson",
          specialty: "General Practitioner",
          image:
            "https://storage.googleapis.com/a1aa/image/b0dcd950-d2de-47e2-3a53-88b50bec994b.jpg",
          description:
            "Providing comprehensive primary care and health advice for all ages.",
          experience: "9 years",
          rating: 4.8,
          available: true,
        },
        {
          id: 6,
          name: "Dr. Michael Brown",
          specialty: "Orthopedic Surgeon",
          image:
            "https://storage.googleapis.com/a1aa/image/f7709932-2855-49d4-32c6-d24c6f957740.jpg",
          description:
            "Specialist in bone and joint surgery with 15 years of surgical experience.",
          experience: "15 years",
          rating: 4.9,
          available: true,
        },
        
      ],
      appointments: [],
      users: [],
      settings: {
        hospitalName: "WellBeing Hospital",
        contactEmail: "support@wellbeinghospital.com",
        contactPhone: "+1 (555) 123-4567",
        workingHours: "9:00 AM - 6:00 PM",
      },
    };
    saveData(initialData);
  }
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Error loading data:", error);
    return { doctors: [], appointments: [], users: [], settings: {} };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving data:", error);
    return false;
  }
}

// Enhanced authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
};

// Enhanced routes

// Get all doctors with filtering and search
app.get("/api/doctors", (req, res) => {
  const { specialty, search, available } = req.query;
  let data = loadData();
  let doctors = data.doctors;

  // Apply filters
  if (specialty && specialty !== "all") {
    doctors = doctors.filter((doctor) => doctor.specialty === specialty);
  }

  if (search) {
    doctors = doctors.filter(
      (doctor) =>
        doctor.name.toLowerCase().includes(search.toLowerCase()) ||
        doctor.specialty.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (available !== undefined) {
    doctors = doctors.filter(
      (doctor) => doctor.available === (available === "true")
    );
  }

  res.json({
    success: true,
    data: doctors,
    total: doctors.length,
  });
});

// Get single doctor
app.get("/api/doctors/:id", (req, res) => {
  const data = loadData();
  const doctor = data.doctors.find((d) => d.id === parseInt(req.params.id));

  if (!doctor) {
    return res.status(404).json({ error: "Doctor not found" });
  }

  res.json({ success: true, data: doctor });
});

// Enhanced appointment booking with validation
app.post("/api/appointments", async (req, res) => {
  try {
    const appointmentData = req.body;
    const data = loadData();

    // Enhanced validation
    const requiredFields = [
      "doctor",
      "fullName",
      "email",
      "phone",
      "date",
      "time",
    ];
    const missingFields = requiredFields.filter(
      (field) => !appointmentData[field]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missing: missingFields,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(appointmentData.email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if time slot is available
    const existingAppointment = data.appointments.find(
      (apt) =>
        apt.doctor === appointmentData.doctor &&
        apt.date === appointmentData.date &&
        apt.time === appointmentData.time
    );

    if (existingAppointment) {
      return res.status(409).json({ error: "Time slot already booked" });
    }

    // Create enhanced appointment
    const appointment = {
      id: Date.now(),
      ...appointmentData,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      appointmentId: `APT-${Date.now()}`,
      patientId: `PAT-${Date.now()}`,
    };

    data.appointments.push(appointment);
    saveData(data);

    // Real-time notification
    io.emit("appointmentUpdated", {
      type: "new",
      appointment: appointment,
    });

    // Notify about new appointment (admin)
    io.emit("adminNotification", {
      type: "new_appointment",
      message: `New appointment booked with ${appointment.doctor}`,
      appointment: appointment,
    });

    res.json({
      success: true,
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointmentId,
      message: "Appointment booked successfully",
    });
  } catch (error) {
    console.error("Appointment booking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enhanced admin login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const data = loadData();
    const adminUser = data.users.find(
      (user) => user.email === email && user.role === "admin"
    );

    if (!adminUser) {
      // Create default admin if not exists
      if (email === "admin@wellbeinghospital.com") {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const newAdmin = {
          id: Date.now(),
          email: email,
          password: hashedPassword,
          role: "admin",
          name: "System Administrator",
          createdAt: new Date().toISOString(),
        };

        data.users.push(newAdmin);
        saveData(data);

        const token = jwt.sign({ id: newAdmin.id, role: "admin" }, JWT_SECRET, {
          expiresIn: "24h",
        });

        return res.json({
          success: true,
          token,
          user: {
            name: newAdmin.name,
            email: newAdmin.email,
            role: newAdmin.role,
          },
          message: "Admin account created and logged in successfully",
        });
      }

      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, adminUser.password);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: adminUser.id, role: "admin" }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      success: true,
      token,
      user: {
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enhanced appointments management
app.get("/api/admin/appointments", authenticateAdmin, (req, res) => {
  const { status, doctor, date, page = 1, limit = 10 } = req.query;
  const data = loadData();
  let appointments = data.appointments;

  // Apply filters
  if (status) {
    appointments = appointments.filter((apt) => apt.status === status);
  }

  if (doctor) {
    appointments = appointments.filter((apt) => apt.doctor.includes(doctor));
  }

  if (date) {
    appointments = appointments.filter((apt) => apt.date === date);
  }

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedAppointments = appointments.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedAppointments,
    pagination: {
      current: parseInt(page),
      total: Math.ceil(appointments.length / limit),
      totalAppointments: appointments.length,
    },
  });
});

// Enhanced appointment status update
app.patch(
  "/api/admin/appointments/:id/status",
  authenticateAdmin,
  (req, res) => {
    const { status } = req.body;
    const appointmentId = parseInt(req.params.id);

    const validStatuses = [
      "confirmed",
      "cancelled",
      "completed",
      "rescheduled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const data = loadData();
    const appointment = data.appointments.find(
      (apt) => apt.id === appointmentId
    );

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    appointment.status = status;
    appointment.updatedAt = new Date().toISOString();
    saveData(data);

    // Real-time update
    io.emit("appointmentUpdated", {
      type: "statusUpdated",
      appointmentId: appointmentId,
      status: status,
      appointment: appointment,
    });

    res.json({
      success: true,
      message: "Appointment status updated",
      appointment: appointment,
    });
  }
);

// Enhanced appointment deletion
app.delete("/api/admin/appointments/:id", authenticateAdmin, (req, res) => {
  const appointmentId = parseInt(req.params.id);
  const data = loadData();

  const initialLength = data.appointments.length;
  data.appointments = data.appointments.filter(
    (apt) => apt.id !== appointmentId
  );

  if (data.appointments.length < initialLength) {
    saveData(data);

    io.emit("appointmentUpdated", {
      type: "deleted",
      appointmentId: appointmentId,
    });

    res.json({ success: true, message: "Appointment deleted successfully" });
  } else {
    res.status(404).json({ error: "Appointment not found" });
  }
});

// Statistics endpoint
app.get("/api/admin/statistics", authenticateAdmin, (req, res) => {
  const data = loadData();
  const appointments = data.appointments;

  const today = new Date().toISOString().split("T")[0];
  const todayAppointments = appointments.filter((apt) => apt.date === today);

  const statistics = {
    totalAppointments: appointments.length,
    todayAppointments: todayAppointments.length,
    confirmedAppointments: appointments.filter(
      (apt) => apt.status === "confirmed"
    ).length,
    completedAppointments: appointments.filter(
      (apt) => apt.status === "completed"
    ).length,
    cancelledAppointments: appointments.filter(
      (apt) => apt.status === "cancelled"
    ).length,
    totalDoctors: data.doctors.length,
    availableDoctors: data.doctors.filter((doc) => doc.available).length,
  };

  res.json({ success: true, data: statistics });
});

// Settings management
app.get("/api/admin/settings", authenticateAdmin, (req, res) => {
  const data = loadData();
  res.json({ success: true, data: data.settings });
});

app.put("/api/admin/settings", authenticateAdmin, (req, res) => {
  const settings = req.body;
  const data = loadData();

  data.settings = { ...data.settings, ...settings };
  saveData(data);

  res.json({
    success: true,
    message: "Settings updated successfully",
    data: data.settings,
  });
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Enhanced Socket.io for real-time features
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("joinAdmin", () => {
    socket.join("admin");
    console.log("Admin joined:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Initialize and start server
initializeData();
server.listen(PORT, () => {
  console.log(`🚀 Enhanced Server running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}`);
  console.log(`🔑 Default Admin: admin@wellbeinghospital.com / admin123`);
});

module.exports = app;
