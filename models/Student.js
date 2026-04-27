const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: String,
  name: String,
  level: String,
  program: String,
  email: String,

  attendance: [
    {
      date: String,
      checkIn: String,
      checkOut: String
    }
  ]
});

module.exports = mongoose.model('Student', studentSchema);