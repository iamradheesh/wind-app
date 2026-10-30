import mongoose from 'mongoose';

const actualSchema = new mongoose.Schema({
  startTime: { type: Date, required: true, unique: true },
  generation: { type: Number, required: true },
});

const forecastSchema = new mongoose.Schema({
  startTime: { type: Date, required: true },
  publishTime: { type: Date, required: true },
  generation: { type: Number, required: true },
});
forecastSchema.index({ startTime: 1, publishTime: 1 }, { unique: true });

export const Actual = mongoose.model('Actual', actualSchema);
export const Forecast = mongoose.model('Forecast', forecastSchema);
