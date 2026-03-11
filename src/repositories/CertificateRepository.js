'use strict';
const BaseRepository = require('./BaseRepository');
const { Certificate } = require('../models');

class CertificateRepository extends BaseRepository {
  constructor() { super(Certificate); }
}
module.exports = new CertificateRepository();

// 'use strict';
// const BaseRepository = require('./BaseRepository');
// const { Certificate } = require('../models');

// class CertificateRepository extends BaseRepository {
//   constructor() { super(Certificate); }

//   async findByVerificationNumber(certificateNumber) {
//     return await this.model.findOne({ certificateNumber }).populate('student course').lean().exec();
//   }
// }
// module.exports = new CertificateRepository();