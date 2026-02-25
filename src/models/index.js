// Central export file unifying all domain models
const UserModels = require('./core/userDomain.model');
const CourseModels = require('./core/courseDomain.model');
const AssessmentModels = require('./core/assesmentDomain.model');
const ExerciseModels = require('./core/exerciseDomain.model');
const InteractionModels = require('./core/interactionDomain.model');
const CommerceModels = require('./core/commerceDomain.model');
const TrackingModels = require('./core/trackingCertificatsDomain.model');
const MiscModels = require('./core/miscDomain.model');
const studentExperience = require('./core/studentExperienceDomain.model');
const marketing = require('./core/marketingDomain.model');

module.exports = {
  ...UserModels,
  ...CourseModels,
  ...AssessmentModels,
  ...ExerciseModels,
  ...InteractionModels,
  ...CommerceModels,
  ...TrackingModels,
  ...MiscModels,
  ...studentExperience,
  ...marketing
};