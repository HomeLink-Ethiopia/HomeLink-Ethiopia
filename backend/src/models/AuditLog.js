const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true }, 
  targetEntity: {
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
  },
  
  ipAddress: String,
  userAgent: String, 

  before: Object, 
  after: Object,  
  metadata: Object, 

}, { timestamps: true });

auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ "targetEntity.entityType": 1, "targetEntity.entityId": 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// TTL Index to automatically delete logs older than 2 years (approx 63072000 seconds)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
