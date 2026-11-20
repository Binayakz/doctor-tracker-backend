const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  age: { type: Number, required: true, min: 0, max: 125 },
  gender: { type: String, enum: ['female', 'male', 'other', 'prefer_not_to_say'], required: true },
  condition: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  email: { type: String, lowercase: true, trim: true, maxlength: 254, default: '' },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
}, { timestamps: true, versionKey: false });

patientSchema.index({ doctor: 1, createdAt: -1, _id: -1 });
patientSchema.index({ condition: 1, createdAt: -1, _id: -1 });
patientSchema.index({ createdAt: -1, _id: -1 });
patientSchema.index({ name: 'text', condition: 'text', email: 'text' });

module.exports = mongoose.model('Patient', patientSchema);
