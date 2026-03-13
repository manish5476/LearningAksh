// // models/Master.js
// const mongoose = require('mongoose');

// const masterValueSchema = new mongoose.Schema({
//   value: { 
//     type: String, 
//     required: true,
//     trim: true 
//   },
//   label: { 
//     type: String, 
//     required: true,
//     trim: true 
//   },
//   description: String,
  
//   // For hierarchical data (like parent-child relationships)
//   parentValue: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Master' 
//   },
  
//   // Metadata for additional context
//   metadata: {
//     icon: String,
//     color: String,
//     image: String,
//     sortOrder: { type: Number, default: 0 },
//     attributes: {
//       type: Map,
//       of: mongoose.Schema.Types.Mixed
//     }
//   },
  
//   // Status flags
//   isActive: { type: Boolean, default: true },
//   isPublished: { type: Boolean, default: false },
//   isDefault: { type: Boolean, default: false }, // For default selections
//   isSystem: { type: Boolean, default: false }, // System values cannot be deleted
  
//   // Audit fields
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedAt: Date,
  
//   // Soft delete
//   isDeleted: { type: Boolean, default: false },
//   deletedAt: Date,
//   deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { 
//   timestamps: true 
// });

// const masterSchema = new mongoose.Schema({
//   // Master Type Definition
//   masterName: { 
//     type: String, 
//     required: true,
//     unique: true,
//     uppercase: true,
//     trim: true,
//     index: true
//   },
  
//   displayName: { 
//     type: String, 
//     required: true,
//     trim: true 
//   },
  
//   description: String,
  
//   // Master Configuration
//   config: {
//     isHierarchical: { type: Boolean, default: false }, // Allow parent-child relationships
//     allowMultiple: { type: Boolean, default: true }, // Can have multiple values
//     isTranslatable: { type: Boolean, default: false },
//     hasMetadata: { type: Boolean, default: true },
//     validationRules: {
//       minLength: Number,
//       maxLength: Number,
//       pattern: String,
//       customValidator: String // For custom validation functions
//     }
//   },
  
//   // Master Category/Tag for grouping masters
//   category: { 
//     type: String,
//     enum: ['SYSTEM', 'BUSINESS', 'EDUCATION', 'CONTENT', 'USER', 'SETTINGS'],
//     default: 'BUSINESS'
//   },
  
//   // All values for this master
//   values: [masterValueSchema],
  
//   // Statistics
//   stats: {
//     totalValues: { type: Number, default: 0 },
//     activeValues: { type: Number, default: 0 },
//     publishedValues: { type: Number, default: 0 },
//     lastValueAdded: Date
//   },
  
//   // Status flags
//   isActive: { type: Boolean, default: true },
//   isPublished: { type: Boolean, default: false },
//   isLocked: { type: Boolean, default: false }, // Locked masters cannot be modified
//   isSystem: { type: Boolean, default: false }, // System masters cannot be deleted
  
//   // Audit
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   publishedAt: Date,
  
//   // Soft delete
//   isDeleted: { type: Boolean, default: false },
//   deletedAt: Date,
//   deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { 
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Indexes
// masterSchema.index({ masterName: 1 }, { unique: true });
// masterSchema.index({ category: 1, isActive: 1 });
// masterSchema.index({ 'values.value': 1, 'values.isActive': 1 });
// masterSchema.index({ 'values.label': 'text' });

// // Virtual for getting active values only
// masterSchema.virtual('activeValues').get(function() {
//   return this.values.filter(v => v.isActive && v.isPublished);
// });

// // Virtual for getting hierarchical structure
// masterSchema.virtual('hierarchy').get(function() {
//   if (!this.config.isHierarchical) return [];
  
//   const valueMap = new Map();
//   const roots = [];
  
//   // First pass: create map of all values
//   this.values.forEach(value => {
//     valueMap.set(value._id.toString(), {
//       ...value.toObject(),
//       children: []
//     });
//   });
  
//   // Second pass: build hierarchy
//   this.values.forEach(value => {
//     const valueWithChildren = valueMap.get(value._id.toString());
//     if (value.parentValue) {
//       const parent = valueMap.get(value.parentValue.toString());
//       if (parent) {
//         parent.children.push(valueWithChildren);
//       }
//     } else {
//       roots.push(valueWithChildren);
//     }
//   });
  
//   return roots;
// });

// // Pre-save middleware to update stats
// masterSchema.pre('save', function(next) {
//   if (this.values) {
//     this.stats.totalValues = this.values.length;
//     this.stats.activeValues = this.values.filter(v => v.isActive).length;
//     this.stats.publishedValues = this.values.filter(v => v.isPublished).length;
    
//     // Update lastValueAdded
//     const lastValue = this.values[this.values.length - 1];
//     if (lastValue) {
//       this.stats.lastValueAdded = lastValue.createdAt;
//     }
//   }
//   next();
// });

// // Static method to get values by master name
// masterSchema.statics.getMasterValues = async function(masterName, options = {}) {
//   const { activeOnly = true, publishedOnly = true, includeMetadata = false } = options;
  
//   const master = await this.findOne({ 
//     masterName: masterName.toUpperCase(),
//     isActive: true,
//     isPublished: true
//   });
  
//   if (!master) return [];
  
//   let values = master.values;
  
//   if (activeOnly) {
//     values = values.filter(v => v.isActive);
//   }
  
//   if (publishedOnly) {
//     values = values.filter(v => v.isPublished);
//   }
  
//   return values.map(v => ({
//     id: v._id,
//     value: v.value,
//     label: v.label,
//     description: v.description,
//     ...(includeMetadata && { metadata: v.metadata })
//   }));
// };

// // Static method to validate value against master
// masterSchema.statics.validateValue = async function(masterName, value) {
//   const master = await this.findOne({ 
//     masterName: masterName.toUpperCase(),
//     isActive: true 
//   });
  
//   if (!master) return false;
  
//   return master.values.some(v => 
//     v.value === value && v.isActive && v.isPublished
//   );
// };

// module.exports = mongoose.model('Master', masterSchema);