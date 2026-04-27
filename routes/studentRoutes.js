const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");
const { sendEmail } = require("../utils/mailer");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const Student = require("../models/Student");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, "students.xlsx");
  },
});

const upload = multer({ storage });
/* ✅ GET STUDENTS */

/* ✅ GENERATE QR */
router.post("/generate-qr", async (req, res) => {
  const { studentId } = req.body;

  const qrData = JSON.stringify({ studentId });
  const qrImage = await QRCode.toDataURL(qrData);

  res.json({ qrImage });
});

/* ✅ VERIFY ATTENDANCE */
// router.post("/verify", async (req, res) => {
//   const { studentId } = req.body;

//   const student = await Student.findOne({ studentId });

//   if (!student) {
//     return res.json({ message: "❌ Student not found" });
//   }

//   const today = new Date().toISOString().split("T")[0];

//   let record = student.attendance.find(a => a.date === today);

//   // ❌ already checked in → DO NOTHING
//   if (record && record.checkIn) {
//     return res.json({
//       message: "⚠️ Already checked in",
//       student,
//     });
//   }

//   // ✅ create record
//   if (!record) {
//     record = { date: today };
//     student.attendance.push(record);
//   }

//   // ✅ ONLY check-in
//   record.checkIn = new Date().toLocaleString();

//   await student.save();

//   res.json({
//     message: "✅ Check-in recorded",
//     student,
//   });
// });
router.post("/verify", async (req, res) => {
  const { studentId } = req.body;

  const student = await Student.findOne({ studentId });

  if (!student) {
    return res.json({ message: "❌ Student not found" });
  }

  const today = new Date().toISOString().split("T")[0];

  let record = student.attendance.find(a => a.date === today);

  // ✅ If already checked in → STOP
  if (record && record.checkIn) {
    return res.json({
      message: "⚠️ Already checked in",
      student,
    });
  }

  // ✅ If no record → CREATE FULL record (NOT empty)
  if (!record) {
    record = {
      date: today,
      checkIn: new Date().toLocaleString(), // 🔥 IMPORTANT
    };

    student.attendance.push(record);
  } else {
    // ✅ If exists but no checkIn → update it
    record.checkIn = new Date().toLocaleString();
  }

  // ✅ ONLY ONE SAVE
  await student.save();

  res.json({
    message: "✅ Check-in recorded",
    student,
  });
});
router.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    const filePath = path.join(__dirname, "../uploads/students.xlsx");

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    let count = 0;

    for (let row of data) {
      await Student.updateOne(
        { studentId: row["Student ID"]?.toString() },
        {
          studentId: row["Student ID"]?.toString(),
          name: row["Student Name"],
          level: row["Level"],
          program: row["Program"],
          email: row["Email"],
        },
        { upsert: true },
      );

      count++;
    }

    res.json({ message: `✅ Imported ${count} students` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Upload failed" });
  }
});

/* 🚪 RECORD LEAVE */
router.post("/leave", async (req, res) => {
  const { studentId } = req.body;

  const student = await Student.findOne({ studentId });

  if (!student) {
    return res.json({ message: "❌ Student not found" });
  }

  const today = new Date().toISOString().split("T")[0];

  let record = student.attendance.find(a => a.date === today);

  // ❌ must check-in first
  if (!record || !record.checkIn) {
    return res.json({
      message: "❌ Must check-in first",
      student,
    });
  }

  // ❌ already checked out
  if (record.checkOut) {
    return res.json({
      message: "⚠️ Already checked out",
      student,
    });
  }

  // ✅ ONLY check-out
  record.checkOut = new Date().toLocaleString();

  await student.save();

  res.json({
    message: "🚪 Check-out recorded",
    student,
  });
});

/*********************** ✅ EXPORT ATTENDANCE AS EXCEL***************** */

router.get("/export", async (req, res) => {
  const students = await Student.find();

  let data = [];

  students.forEach(s => {
    // if student has attendance
    if (s.attendance.length > 0) {
      s.attendance.forEach(a => {
        data.push({
          "Student Name": s.name,
          "Student ID": s.studentId,
          Level: s.level,
          Program: s.program,
          Email: s.email,

          Date: a.date,
          "Check In": a.checkIn || "",
          "Check Out": a.checkOut || "",
        });
      });
    } else {
      // student without attendance
      data.push({
        "Student Name": s.name,
        "Student ID": s.studentId,
        Level: s.level,
        Program: s.program,
        Email: s.email,

        Date: "",
        "Check In": "",
        "Check Out": "",
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  res.setHeader("Content-Disposition", "attachment; filename=attendance.xlsx");

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  res.send(buffer);
});

/* ✅ SEND EMAILS WITH QR ATTACHMENT */
// router.post("/send-emails", async (req, res) => {
//   const students = readExcel();

//   for (let s of students) {
//     try {
//       const email = s["Email"];
//       if (!email) continue;

//       const qrData = JSON.stringify({
//         studentId: s["Student ID"],
//       });

//       // 🔥 Generate QR as file buffer
//       const qrImage = await QRCode.toBuffer(qrData);

//       const html = `
//   <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">

//     <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background:white; border-radius:10px; padding:20px;">

//       <!-- HEADER -->
//       <tr>
//         <!-- LOGO LEFT -->
//         <td style="width:80px; vertical-align:top;">
//           <img
//             src="http://www.hnu.edu.eg/images/logo.png"
//             alt="Logo"
//             style="width:70px;"
//           />
//         </td>

//         <!-- TEXT RIGHT -->
//         <td style="vertical-align:top; padding-left:10px;">
//           <h2 style="margin:0; color:#2c3e50;">Attendance System</h2>
//           <p style="margin:5px 0; color:#555;">
//             Hello <strong>${s["Student Name"]}</strong>
//           </p>
//         </td>
//       </tr>

//       <!-- BODY -->
//       <tr>
//         <td colspan="2" style="padding-top:20px; text-align:center;">
//           <p style="color:#555;">
//             Please find your QR code attached below. Don't Share it with anyone, as it's unique to you and will be used for attendance verification.
//           </p>
//         </td>
//       </tr>

//       <!-- FOOTER -->
//       <tr>
//         <td colspan="2" style="padding-top:20px; text-align:center; font-size:12px; color:#999;">
//           © 2026 HNU. All rights reserved.
//         </td>
//       </tr>

//     </table>
//   </div>
// `;
//       await sendEmail(email, "Your Attendance QR Code", html, {
//         filename: "qr.png",
//         content: qrImage,
//       });

//       console.log("Sent to:", email);
//     } catch (err) {
//       console.error("Failed:", s["Student Name"], err.message);
//     }
//   }

//   res.json({ message: "Emails sent with attachments" });
// });

router.post("/send-emails", async (req, res) => {
  const students = await Student.find(); // ✅ MongoDB

  for (let s of students) {
    try {
      if (!s.email) continue;

      const qrData = JSON.stringify({
        studentId: s.studentId,
      });

      const qrImage = await QRCode.toBuffer(qrData);

      const html = `
        <h2>Hello ${s.name}</h2>
        <p>Your QR is attached</p>
      `;

      await sendEmail(s.email, "Your QR Code", html, {
        filename: "qr.png",
        content: qrImage,
      });

      console.log("Sent to:", s.email);
    } catch (err) {
      console.error("Failed:", s.name, err.message);
    }
  }

  res.json({ message: "Emails sent" });
});

module.exports = router;
