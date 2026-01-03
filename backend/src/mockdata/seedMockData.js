/*
  Seed mock data by calling the real REST API.

  Usage:
    API_BASE_URL=http://localhost:5000/api/v1 node src/mockdata/seedMockData.js

  Or:
    npm run seed:mock

  Notes:
  - Idempotent-ish: if users already exist, it will login instead of re-registering.
  - Payments require Stripe/Razorpay env config; initiation is attempted but failures are skipped.
*/

// Load environment variables
require("dotenv").config();

const axios = require("axios");
const mongoose = require("mongoose");

const API_BASE_URL =
  process.env.API_BASE_URL ||
  `http://localhost:${process.env.PORT || 5000}/api/v1`;

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "Passw0rd!";
console.log(`[seed] Using default password: ${DEFAULT_PASSWORD}`);
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  validateStatus: () => true,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function die(message) {
  // eslint-disable-next-line no-console
  console.error(`\n[seed] ${message}`);
  process.exit(1);
}

function ok(res) {
  return res && res.status >= 200 && res.status < 300;
}

function unwrap(res) {
  // Many endpoints use { success, data }, but some return raw doc in data.
  if (!res || !res.data) return null;
  if (typeof res.data === "object" && res.data !== null) {
    if (Object.prototype.hasOwnProperty.call(res.data, "data")) {
      return res.data.data;
    }
  }
  return res.data;
}

async function request(method, url, { token, data, params } = {}) {
  const res = await http.request({
    method,
    url,
    data,
    params,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });

  if (!ok(res)) {
    const msg =
      res?.data?.message ||
      res?.data?.error ||
      `${method.toUpperCase()} ${url} failed (${res.status})`;
    const details = res?.data?.errors ? JSON.stringify(res.data.errors) : "";
    const err = new Error(details ? `${msg} ${details}` : msg);
    err.response = res;
    throw err;
  }

  return res;
}

async function registerOrLogin({ fullName, email, phone, role }) {
  try {
    console.log(`[seed] Registering user: ${email} with role: ${role}`);
    const res = await request("post", "/auth/register", {
      data: {
        fullName,
        email,
        password: DEFAULT_PASSWORD,
        phone,
        role,
      },
    });

    const payload = unwrap(res);
    console.log(`[seed] ✓ Registered: ${email}`);
    console.log(`[seed] Token received: ${payload.token ? "YES" : "NO"}`);
    return {
      user: payload.user,
      token: payload.token,
    };
  } catch (e) {
    // If already registered, fallback to login.
    const code = e?.response?.status;
    console.log(
      `[seed] Registration failed for ${email} (status: ${code}), trying login...`
    );
    console.log(`[seed] Error details:`, e?.response?.data || e.message);

    if (code !== 400 && code !== 409) throw e;

    const res = await request("post", "/auth/login", {
      data: { email, password: DEFAULT_PASSWORD },
    });
    const payload = unwrap(res);
    console.log(`[seed] ✓ Logged in: ${email}`);
    console.log(`[seed] Token received: ${payload.token ? "YES" : "NO"}`);
    return {
      user: payload.user,
      token: payload.token,
    };
  }
}

async function getOrCreateEvent({ token, event }) {
  try {
    console.log(`[seed] Attempting to create event: "${event.title}"`);
    console.log(
      `[seed] Using token: ${
        token ? token.substring(0, 20) + "..." : "MISSING"
      }`
    );

    // First, check if event already exists by title
    const existingRes = await request("get", "/events", {
      token,
      params: { search: event.title, limit: 1 },
    });

    const existingEvents = unwrap(existingRes);
    if (
      existingEvents &&
      existingEvents.events &&
      existingEvents.events.length > 0
    ) {
      const existing = existingEvents.events[0];
      if (existing.title === event.title) {
        console.log(`[seed] ✓ Event already exists: "${event.title}"`);
        return existing;
      }
    }

    // Event doesn't exist, create it
    const res = await request("post", "/events", { token, data: event });
    const payload = unwrap(res);
    console.log(`[seed] ✓ Created event: "${event.title}"`);
    return payload.event;
  } catch (e) {
    console.error(
      `[seed] Failed to create event "${event.title}":`,
      e?.response?.data?.message || e.message
    );
    throw e;
  }
}

async function publishEvent({ token, eventId }) {
  await request("post", `/events/${eventId}/publish`, { token });
}

async function updateEvent({ token, eventId, patch }) {
  const res = await request("put", `/events/${eventId}`, {
    token,
    data: patch,
  });
  const payload = unwrap(res);
  return payload.event;
}

async function createTeam({ token, eventId, name, description }) {
  const res = await request("post", "/teams", {
    token,
    data: { eventId, name, description },
  });
  return unwrap(res); // team doc
}

async function joinTeam({ token, inviteCode }) {
  const res = await request("post", "/teams/join", {
    token,
    data: { inviteCode },
  });
  return unwrap(res);
}

async function registerForEvent({ token, eventId, teamId }) {
  const res = await request("post", "/registrations", {
    token,
    data: {
      eventId,
      ...(teamId ? { teamId } : {}),
      participantInfo: {
        tshirtSize: "M",
        college: "Mock University",
      },
      emergencyContact: {
        name: "Mock Guardian",
        phone: "9999999999",
        relationship: "parent",
      },
    },
  });
  return unwrap(res); // registration doc
}

async function submitFeedback({ token, eventId, comment }) {
  const res = await request("post", "/feedback", {
    token,
    data: {
      eventId,
      overallRating: 5,
      organizationRating: 5,
      contentQuality: 4,
      comment,
      wouldRecommend: true,
      anonymous: false,
    },
  });
  return unwrap(res);
}

async function createNotification({ token, recipients, title, message }) {
  const res = await request("post", "/notifications", {
    token,
    data: {
      recipients,
      title,
      message,
      type: "seed",
      channels: ["in_app"],
      priority: "normal",
    },
  });
  return unwrap(res);
}

async function generateEventQr({ token, eventId }) {
  const res = await request("get", `/attendance/event/${eventId}/qrcode`, {
    token,
  });
  return unwrap(res);
}

async function selfCheckIn({ token, qrData }) {
  const res = await request("post", "/attendance/self-checkin", {
    token,
    data: { qrData, location: "Main Gate" },
  });
  return unwrap(res);
}

async function organizerCheckIn({ token, eventId, userId }) {
  const res = await request("post", "/attendance/checkin", {
    token,
    data: { eventId, userId, method: "manual", location: "Auditorium" },
  });
  return unwrap(res);
}

async function generateCertificates({ token, eventId }) {
  const res = await request("post", "/certificates/generate", {
    token,
    data: {
      eventId,
      certificateType: "participation",
    },
  });
  return unwrap(res);
}

async function initiatePayment({ token, registrationId, paymentMethod }) {
  const res = await request("post", "/payments/initiate", {
    token,
    data: { registrationId, paymentMethod },
  });
  return unwrap(res);
}

async function completePaymentDirectly(paymentId, registrationId) {
  // Direct database update for seeding - bypasses payment gateway verification
  const Payment = require("../models/Payment");
  const EventRegistration = require("../models/EventRegistration");
  const Event = require("../models/Event");
  const Invoice = require("../models/Invoice");

  const payment = await Payment.findById(paymentId).populate("user event");
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  // Complete the payment
  payment.status = "completed";
  payment.transactionId = `mock_${Date.now()}`;
  payment.paidAt = new Date();
  await payment.save();

  // Update registration
  const registration = await EventRegistration.findById(registrationId);
  if (registration) {
    registration.paymentStatus = "paid";
    registration.payment = payment._id;

    // Confirm registration
    if (registration.status === "pending") {
      registration.status = "confirmed";

      // Update event count
      const event = await Event.findById(registration.event);
      if (event) {
        event.registeredCount = (event.registeredCount || 0) + 1;
        await event.save();
      }
    }
    await registration.save();

    // Create invoice
    await Invoice.create({
      invoiceNumber: `INV-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      user: payment.user._id,
      event: payment.event._id,
      registration: registration._id,
      payment: payment._id,
      amount: payment.amount,
      currency: payment.currency,
      items: [
        {
          description: `Registration for ${payment.event.title}`,
          quantity: 1,
          unitPrice: payment.amount,
          total: payment.amount,
        },
      ],
      subtotal: payment.amount,
      total: payment.amount,
      status: "paid",
      paidAt: new Date(),
    });
  }

  return payment;
}

function nowPlus({ minutes = 0, hours = 0, days = 0 }) {
  return new Date(
    Date.now() + minutes * 60e3 + hours * 3600e3 + days * 86400e3
  );
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`[seed] API_BASE_URL=${API_BASE_URL}`);

  // Check if JWT_SECRET is set (required for authentication)
  if (!process.env.JWT_SECRET) {
    console.error(
      "[seed] ⚠️  WARNING: JWT_SECRET environment variable is not set!"
    );
    console.error(
      "[seed] Authentication may fail. Please set JWT_SECRET in your .env file"
    );
  }

  // Connect to MongoDB for direct database operations
  const mongoUri =
    process.env.MONGO_URI || "mongodb://localhost:27017/event-management";
  await mongoose.connect(mongoUri);
  console.log(`[seed] Connected to MongoDB`);

  // Realistic Users - Organizers
  const organizer1 = await registerOrLogin({
    fullName: "Dr. Rajesh Kumar",
    email: process.env.SEED_ORGANIZER_EMAIL || "rajesh.kumar@university.edu",
    phone: "9876543210",
    role: "department_organizer",
  });

  const organizer2 = await registerOrLogin({
    fullName: "Prof. Anita Sharma",
    email: "anita.sharma@university.edu",
    phone: "9876543211",
    role: "department_organizer",
  });

  // Realistic Students - Computer Science
  const students = [];
  const studentData = [
    {
      name: "Arjun Patel",
      email: "arjun.patel@student.edu",
      phone: "9123456701",
      dept: "CS",
    },
    {
      name: "Priya Reddy",
      email: "priya.reddy@student.edu",
      phone: "9123456702",
      dept: "CS",
    },
    {
      name: "Vikram Singh",
      email: "vikram.singh@student.edu",
      phone: "9123456703",
      dept: "CS",
    },
    {
      name: "Sneha Gupta",
      email: "sneha.gupta@student.edu",
      phone: "9123456704",
      dept: "CS",
    },
    {
      name: "Rahul Verma",
      email: "rahul.verma@student.edu",
      phone: "9123456705",
      dept: "CS",
    },
    {
      name: "Kavya Menon",
      email: "kavya.menon@student.edu",
      phone: "9123456706",
      dept: "CS",
    },
    {
      name: "Aditya Joshi",
      email: "aditya.joshi@student.edu",
      phone: "9123456707",
      dept: "ECE",
    },
    {
      name: "Neha Iyer",
      email: "neha.iyer@student.edu",
      phone: "9123456708",
      dept: "ECE",
    },
    {
      name: "Rohan Das",
      email: "rohan.das@student.edu",
      phone: "9123456709",
      dept: "ECE",
    },
    {
      name: "Anjali Nair",
      email: "anjali.nair@student.edu",
      phone: "9123456710",
      dept: "ME",
    },
    {
      name: "Siddharth Rao",
      email: "siddharth.rao@student.edu",
      phone: "9123456711",
      dept: "ME",
    },
    {
      name: "Pooja Desai",
      email: "pooja.desai@student.edu",
      phone: "9123456712",
      dept: "EE",
    },
    {
      name: "Karthik Bhat",
      email: "karthik.bhat@student.edu",
      phone: "9123456713",
      dept: "EE",
    },
    {
      name: "Divya Pillai",
      email: "divya.pillai@student.edu",
      phone: "9123456714",
      dept: "CE",
    },
    {
      name: "Akash Kumar",
      email: "akash.kumar@student.edu",
      phone: "9123456715",
      dept: "CE",
    },
  ];

  for (const data of studentData) {
    const student = await registerOrLogin({
      fullName: data.name,
      email: data.email,
      phone: data.phone,
      role: "student",
    });
    students.push({ ...student, dept: data.dept });
    await sleep(100); // Small delay between user creation
  }

  console.log(`[seed] Created/logged in ${students.length} students`);

  // Events with realistic details
  const futureStart = nowPlus({ days: 10 });
  const futureEnd = nowPlus({ days: 10, hours: 6 });
  const deadline = nowPlus({ days: 7 });

  const upcomingStart = nowPlus({ days: 3 });
  const upcomingEnd = nowPlus({ days: 3, hours: 4 });
  const upcomingDeadline = nowPlus({ days: 2 });

  console.log("[seed] Creating realistic events...");

  // Event 1: Tech Hackathon (Team Event - Upcoming)
  const hackathon = await getOrCreateEvent({
    token: organizer1.token,
    event: {
      title: "TechVerse Hackathon 2025",
      description:
        "Build innovative solutions for real-world problems. 48-hour coding marathon with prizes worth ₹1,00,000. Categories: Web Development, Mobile Apps, AI/ML, and Blockchain. Mentorship from industry experts, free meals, and swag for all participants!",
      rules:
        "Team size: 2-4 members. All code must be original. Use of external APIs allowed. Judging criteria: Innovation (30%), Implementation (30%), Design (20%), Presentation (20%).",
      registrationDeadline: upcomingDeadline.toISOString(),
      startDateTime: upcomingStart.toISOString(),
      endDateTime: upcomingEnd.toISOString(),
      venue: "Computer Science Block, Lab 301-305",
      eventMode: "offline",
      eventType: "hackathon",
      minTeamSize: 2,
      maxTeamSize: 4,
      isPaid: false,
      maxParticipants: 100,
      visibility: "public",
      certificateProvided: true,
      eligibility:
        "Open to all undergraduate and postgraduate students from engineering and technology programs",
      eligibleYears: [1, 2, 3, 4],
      eligibleDepartments: ["CS", "ECE", "IT", "EE"],
      allowExternalStudents: true,
      tags: ["hackathon", "coding", "tech"],
    },
  });
  await publishEvent({ token: organizer1.token, eventId: hackathon._id });

  // Event 2: AI/ML Workshop (Solo Event - Future)
  const mlWorkshop = await getOrCreateEvent({
    token: organizer2.token,
    event: {
      title: "Introduction to Machine Learning & Deep Learning",
      description:
        "Hands-on workshop covering fundamentals of ML, neural networks, and practical implementation using Python, TensorFlow, and PyTorch. Build your first image classifier! Prerequisites: Basic Python knowledge. Bring your laptop.",
      rules:
        "Attendance mandatory for certificate. Laptop required. Install Python 3.8+ and Jupyter Notebook beforehand.",
      registrationDeadline: deadline.toISOString(),
      startDateTime: futureStart.toISOString(),
      endDateTime: futureEnd.toISOString(),
      venue: "Seminar Hall A, Ground Floor",
      eventMode: "hybrid",
      meetingLink: "https://meet.google.com/xyz-demo-link",
      eventType: "workshop",
      minTeamSize: 1,
      maxTeamSize: 1,
      isPaid: true,
      amount: 299,
      maxParticipants: 80,
      visibility: "public",
      certificateProvided: true,
      eligibility:
        "Students with basic programming knowledge. Preference given to CS/ECE/IT students.",
      eligibleYears: [2, 3, 4],
      eligibleDepartments: ["CS", "ECE", "IT", "EE", "ME"],
      allowExternalStudents: false,
      tags: ["workshop", "AI", "machine-learning"],
    },
  });
  await publishEvent({ token: organizer2.token, eventId: mlWorkshop._id });

  // Event 3: Cultural Fest (Team Event - Future)
  const culturalFest = await getOrCreateEvent({
    token: organizer1.token,
    event: {
      title: "Spring Fest 2025 - Dance Competition",
      description:
        "Showcase your dance talent! Categories: Classical, Contemporary, Hip-Hop, and Fusion. Winner gets ₹25,000 cash prize + trophy. Runner-up: ₹15,000. All participants receive participation certificates and exclusive merchandise.",
      rules:
        "Team size: 5-10 members. Performance time: 5-8 minutes. Music track must be submitted 2 days before event. No vulgarity or offensive content.",
      registrationDeadline: deadline.toISOString(),
      startDateTime: futureStart.toISOString(),
      endDateTime: futureEnd.toISOString(),
      venue: "Open Air Theatre, Main Campus",
      eventMode: "offline",
      eventType: "competition",
      minTeamSize: 5,
      maxTeamSize: 10,
      isPaid: true,
      amount: 500,
      maxParticipants: 150,
      visibility: "public",
      certificateProvided: true,
      eligibility: "Open to all students from any department or year",
      eligibleYears: [1, 2, 3, 4, 5],
      eligibleDepartments: [
        "CS",
        "ECE",
        "EE",
        "ME",
        "CE",
        "IT",
        "CHE",
        "BT",
        "CIVIL",
      ],
      allowExternalStudents: true,
      tags: ["cultural", "dance", "competition"],
    },
  });
  await publishEvent({ token: organizer1.token, eventId: culturalFest._id });

  // Event 4: Tech Talk (Solo Event - Future)
  const techTalk = await getOrCreateEvent({
    token: organizer2.token,
    event: {
      title: "Career in Cloud Computing & DevOps",
      description:
        "Industry expert from Amazon Web Services will share insights on cloud computing trends, career opportunities, and essential skills. Q&A session included. Perfect for final year students planning their careers!",
      rules:
        "Professional attire recommended. Questions can be submitted beforehand via email.",
      registrationDeadline: nowPlus({ days: 14 }).toISOString(),
      startDateTime: nowPlus({ days: 15 }).toISOString(),
      endDateTime: nowPlus({ days: 15, hours: 2 }).toISOString(),
      venue: "Main Auditorium",
      eventMode: "hybrid",
      meetingLink: "https://meet.google.com/aws-tech-talk",
      eventType: "seminar",
      minTeamSize: 1,
      maxTeamSize: 1,
      isPaid: false,
      maxParticipants: 200,
      visibility: "public",
      certificateProvided: false,
      eligibility:
        "Open to all students, especially those interested in cloud technologies and DevOps",
      eligibleYears: [3, 4],
      eligibleDepartments: ["CS", "IT", "ECE"],
      allowExternalStudents: false,
      tags: ["seminar", "cloud", "career"],
    },
  });
  await publishEvent({ token: organizer2.token, eventId: techTalk._id });

  // Event 5: Sports Tournament (Team Event - Past/Completed for testing)
  const sportsEvent = await getOrCreateEvent({
    token: organizer1.token,
    event: {
      title: "Inter-Department Cricket Tournament 2024",
      description:
        "Annual cricket tournament concluded successfully! Thanks to all teams for their enthusiastic participation. CS Department emerged as champions!",
      rules:
        "Standard cricket rules. 20 overs per side. Team of 11 players + 4 substitutes.",
      registrationDeadline: nowPlus({ hours: -168 }).toISOString(), // 7 days ago
      startDateTime: nowPlus({ hours: -72 }).toISOString(), // 3 days ago
      endDateTime: nowPlus({ hours: -66 }).toISOString(), // 2.75 days ago
      venue: "University Cricket Ground",
      eventMode: "offline",
      eventType: "competition",
      minTeamSize: 11,
      maxTeamSize: 15,
      isPaid: false,
      maxParticipants: 180,
      visibility: "public",
      certificateProvided: true,
      eligibility: "Open to all departments. Players must be current students.",
      eligibleYears: [1, 2, 3, 4],
      eligibleDepartments: ["CS", "ECE", "EE", "ME", "CE", "IT"],
      allowExternalStudents: false,
      tags: ["sports", "cricket", "tournament"],
      status: "completed",
    },
  });
  await publishEvent({ token: organizer1.token, eventId: sportsEvent._id });

  console.log("[seed] Created 5 diverse events");

  // Create realistic teams for Hackathon
  console.log("[seed] Creating teams for hackathon...");
  const teams = [];

  // Team 1: Code Warriors (4 members)
  const team1 = await createTeam({
    token: students[0].token, // Arjun as leader
    eventId: hackathon._id,
    name: "Code Warriors",
    description:
      "Passionate about building scalable web applications with modern tech stack",
  });
  await joinTeam({ token: students[1].token, inviteCode: team1.inviteCode }); // Priya
  await joinTeam({ token: students[2].token, inviteCode: team1.inviteCode }); // Vikram
  await joinTeam({ token: students[3].token, inviteCode: team1.inviteCode }); // Sneha
  teams.push(team1);

  // Team 2: Innovators (3 members)
  const team2 = await createTeam({
    token: students[4].token, // Rahul as leader
    eventId: hackathon._id,
    name: "Tech Innovators",
    description:
      "AI/ML enthusiasts working on intelligent automation solutions",
  });
  await joinTeam({ token: students[5].token, inviteCode: team2.inviteCode }); // Kavya
  await joinTeam({ token: students[6].token, inviteCode: team2.inviteCode }); // Aditya
  teams.push(team2);

  // Team 3: Binary Beasts (2 members)
  const team3 = await createTeam({
    token: students[7].token, // Neha as leader
    eventId: hackathon._id,
    name: "Binary Beasts",
    description:
      "Full-stack developers specializing in cloud-native applications",
  });
  await joinTeam({ token: students[8].token, inviteCode: team3.inviteCode }); // Rohan
  teams.push(team3);

  // Team 4: Debug Dragons (4 members)
  const team4 = await createTeam({
    token: students[9].token, // Anjali as leader
    eventId: hackathon._id,
    name: "Debug Dragons",
    description:
      "Mobile app developers focused on user experience and performance",
  });
  await joinTeam({ token: students[10].token, inviteCode: team4.inviteCode }); // Siddharth
  await joinTeam({ token: students[11].token, inviteCode: team4.inviteCode }); // Pooja
  await joinTeam({ token: students[12].token, inviteCode: team4.inviteCode }); // Karthik
  teams.push(team4);

  console.log(`[seed] Created ${teams.length} teams for hackathon`);

  // Register teams for hackathon
  console.log("[seed] Registering teams for hackathon...");
  const hackathonRegs = [];

  // Team 1 registrations
  for (let i = 0; i <= 3; i++) {
    const reg = await registerForEvent({
      token: students[i].token,
      eventId: hackathon._id,
      teamId: team1._id,
    });
    hackathonRegs.push(reg);
  }

  // Team 2 registrations
  for (let i = 4; i <= 6; i++) {
    const reg = await registerForEvent({
      token: students[i].token,
      eventId: hackathon._id,
      teamId: team2._id,
    });
    hackathonRegs.push(reg);
  }

  // Team 3 registrations
  for (let i = 7; i <= 8; i++) {
    const reg = await registerForEvent({
      token: students[i].token,
      eventId: hackathon._id,
      teamId: team3._id,
    });
    hackathonRegs.push(reg);
  }

  // Team 4 registrations
  for (let i = 9; i <= 12; i++) {
    const reg = await registerForEvent({
      token: students[i].token,
      eventId: hackathon._id,
      teamId: team4._id,
    });
    hackathonRegs.push(reg);
  }

  console.log(
    `[seed] Registered ${hackathonRegs.length} participants for hackathon`
  );

  // Individual registrations for ML Workshop (Paid Event - ₹299)
  console.log("[seed] Registering students for ML workshop...");
  const workshopRegs = [];
  for (let i = 0; i < 8; i++) {
    const reg = await registerForEvent({
      token: students[i].token,
      eventId: mlWorkshop._id,
    });
    workshopRegs.push(reg);

    // Complete payment for paid event
    try {
      console.log(`[seed] Processing payment for ${students[i].user.email}...`);
      const paymentResult = await initiatePayment({
        token: students[i].token,
        registrationId: reg.registration._id,
        paymentMethod: "razorpay",
      });

      // Complete the payment directly in database
      await completePaymentDirectly(
        paymentResult.payment._id,
        reg.registration._id
      );
      console.log(`[seed] ✓ Payment completed for workshop registration`);
    } catch (e) {
      console.warn(
        `[seed] Payment processing skipped for ${students[i].user.email}: ${e.message}`
      );
    }

    await sleep(100);
  }
  console.log(
    `[seed] Registered ${workshopRegs.length} students for workshop with payments`
  );

  // Register for Tech Talk
  console.log("[seed] Registering for tech talk...");
  const talkRegs = [];
  for (let i = 0; i < 5; i++) {
    const reg = await registerForEvent({
      token: students[i].token,
      eventId: techTalk._id,
    });
    talkRegs.push(reg);
  }
  console.log(`[seed] Registered ${talkRegs.length} students for tech talk`);

  // Create teams and register for cultural fest
  console.log("[seed] Creating teams for cultural fest...");
  const danceTeam1 = await createTeam({
    token: students[0].token,
    eventId: culturalFest._id,
    name: "Rhythm Riders",
    description: "Contemporary fusion dance troupe",
  });
  for (let i = 1; i < 7; i++) {
    await joinTeam({
      token: students[i].token,
      inviteCode: danceTeam1.inviteCode,
    });
  }

  const culturalRegs = [];
  for (let i = 0; i < 7; i++) {
    const reg = await registerForEvent({
      token: students[i].token,
      eventId: culturalFest._id,
      teamId: danceTeam1._id,
    });
    culturalRegs.push(reg);

    // Complete payment for paid event (₹500)
    try {
      console.log(`[seed] Processing payment for ${students[i].user.email}...`);
      const paymentResult = await initiatePayment({
        token: students[i].token,
        registrationId: reg.registration._id,
        paymentMethod: "razorpay",
      });

      // Complete the payment directly in database
      await completePaymentDirectly(
        paymentResult.payment._id,
        reg.registration._id
      );
      console.log(`[seed] ✓ Payment completed for cultural fest registration`);
    } catch (e) {
      console.warn(
        `[seed] Payment processing skipped for ${students[i].user.email}: ${e.message}`
      );
    }

    await sleep(100);
  }
  console.log(
    `[seed] Registered ${culturalRegs.length} students for cultural fest with payments`
  );

  // Simulate completed sports event with attendance
  console.log("[seed] Setting up completed sports event...");
  const cricketTeam = await createTeam({
    token: students[4].token, // Use student 4 as leader (different from other teams)
    eventId: sportsEvent._id,
    name: "CS Warriors",
    description: "Computer Science Department Cricket Team",
  });
  // Add students 5-14 to make 11 total members
  for (let i = 5; i < 15; i++) {
    await joinTeam({
      token: students[i].token,
      inviteCode: cricketTeam.inviteCode,
    });
  }

  // Register cricket team (students 4-14)
  for (let i = 4; i < 15; i++) {
    await registerForEvent({
      token: students[i].token,
      eventId: sportsEvent._id,
      teamId: cricketTeam._id,
    });
  }

  // Mark attendance for completed event
  try {
    for (let i = 4; i < 15; i++) {
      await organizerCheckIn({
        token: organizer1.token,
        eventId: sportsEvent._id,
        userId: students[i].user._id,
      });
      await sleep(50);
    }
    console.log("[seed] Marked attendance for sports event");
  } catch (e) {
    console.warn(`[seed] Attendance marking skipped: ${e.message}`);
  }

  // Generate certificates for completed event
  try {
    const certResult = await generateCertificates({
      token: organizer1.token,
      eventId: sportsEvent._id,
    });
    console.log(
      `[seed] Generated ${certResult.generated} certificates for sports event`
    );
  } catch (e) {
    console.warn(`[seed] Certificate generation skipped: ${e.message}`);
  }

  // Submit feedback for completed event
  const feedbackComments = [
    "Excellent organization! Had a great time playing.",
    "Well managed tournament. Looking forward to next year!",
    "Great experience. The venue and arrangements were perfect.",
  ];

  for (let i = 0; i < 3; i++) {
    try {
      await submitFeedback({
        token: students[i + 4].token, // Use students 4, 5, 6 for feedback
        eventId: sportsEvent._id,
        comment: feedbackComments[i],
      });
    } catch (e) {
      console.warn(`[seed] Feedback ${i + 1} skipped: ${e.message}`);
    }
  }
  console.log("[seed] Submitted feedback for completed event");

  // Create notifications
  console.log("[seed] Creating notifications...");
  try {
    await createNotification({
      token: organizer1.token,
      recipients: students.slice(0, 13).map((s) => s.user._id),
      title: "TechVerse Hackathon Reminder",
      message:
        "Don't forget to bring your laptops and chargers! Event starts in 3 days.",
    });

    await request("post", `/notifications/bulk/event/${hackathon._id}`, {
      token: organizer1.token,
      data: {
        title: "Team Registration Confirmed",
        message:
          "Your team has been successfully registered for TechVerse Hackathon 2025. Check your email for venue details and schedule.",
        channels: ["in_app"],
      },
    });
    console.log("[seed] Created notifications");
  } catch (e) {
    console.warn(`[seed] Notifications skipped: ${e.message}`);
  }

  // Small delay so async email/sms/notification jobs (if enabled) have a moment.
  await sleep(200);

  // eslint-disable-next-line no-console
  console.log("\n[seed] ✅ Database seeding completed successfully!");
  console.log("\n[seed] 📊 Summary:");
  console.log(
    `   • Organizers: 2 (${organizer1.user.email}, ${organizer2.user.email})`
  );
  console.log(`   • Students: ${students.length}`);
  console.log(
    `   • Events: 5 (Hackathon, ML Workshop, Cultural Fest, Tech Talk, Sports Tournament)`
  );
  console.log(
    `   • Teams: ${
      teams.length + 2
    } (4 hackathon teams, 1 cultural team, 1 cricket team)`
  );
  console.log(
    `   • Total Registrations: ${
      hackathonRegs.length +
      workshopRegs.length +
      talkRegs.length +
      culturalRegs.length +
      11
    }`
  );
  console.log("\n[seed] 🎯 Test Users:");
  console.log(`   Organizer: ${organizer1.user.email} / ${DEFAULT_PASSWORD}`);
  console.log(`   Student: ${students[0].email} / ${DEFAULT_PASSWORD}`);
  console.log("\n[seed] 🎪 Events Status:");
  console.log(
    `   • TechVerse Hackathon: Published, Upcoming (${hackathonRegs.length} registrations)`
  );
  console.log(
    `   • ML Workshop: Published, Future (${workshopRegs.length} registrations)`
  );
  console.log(
    `   • Cultural Fest: Published, Future (${culturalRegs.length} registrations)`
  );
  console.log(
    `   • Tech Talk: Published, Future (${talkRegs.length} registrations)`
  );
  console.log(
    `   • Cricket Tournament: Completed with certificates (11 registrations)`
  );
  console.log(
    "\n[seed] Ready to use! Login with any of the above credentials."
  );

  // Close database connection
  await mongoose.connection.close();
  console.log("[seed] Database connection closed");
}

main().catch((e) => {
  die(e?.message || String(e));
});
