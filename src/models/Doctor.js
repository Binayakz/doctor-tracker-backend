const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  specialization: { type: String, required: true, trim: true, maxlength: 100 },
  hospital: { type: String, required: true, trim: true, maxlength: 160 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
}, { timestamps: true, versionKey: false });

doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 });
doctorSchema.index({ createdAt: -1, _id: -1 });
doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ name: 'text', specialization: 'text', hospital: 'text', email: 'text' });

module.exports = mongoose.model('Doctor', doctorSchema);
