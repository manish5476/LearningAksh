'use strict';
const BaseRepository = require('./BaseRepository');
const { QuizQuestion } = require('../models');

class QuizQuestionRepository extends BaseRepository {
  constructor() { super(QuizQuestion); }

  async findQuestionsByQuizId(quizId) {
    return await this.model.find({ quiz: quizId }).sort('order').lean().exec();
  }
}
module.exports = new QuizQuestionRepository();