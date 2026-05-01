const mongoose = require('mongoose');

const GameChallengeSchema = new mongoose.Schema({
  challengeId: { type: String, required: true },
  title: { type: String, required: true },
  brief: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  dueInHours: { type: Number, default: 72 },
  estimateHours: { type: Number, default: 2 },
  impact: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  signal: { type: String, default: '' },
  correctAnswer: { type: String, required: true },
  basePoints: { type: Number, default: 100 }
}, { _id: false });

const GameAnswerSchema = new mongoose.Schema({
  challengeId: { type: String, required: true },
  answer: { type: String, required: true },
  correct: { type: Boolean, default: false },
  points: { type: Number, default: 0 }
}, { _id: false });

const GameSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gameKey: { type: String, default: 'ops-arena', index: true },
  durationSeconds: { type: Number, default: 75 },
  challenges: [GameChallengeSchema],
  answers: [GameAnswerSchema],
  score: { type: Number, default: 0, index: true },
  accuracy: { type: Number, default: 0 },
  wpm: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  maxStreak: { type: Number, default: 0 },
  elapsedMs: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  completedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

module.exports = mongoose.model('GameSession', GameSessionSchema);
