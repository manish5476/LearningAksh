const { Client } = require('@elastic/elasticsearch');
const { Course, User, Lesson } = require('../models');
const cacheService = require('./cacheService');
const AppError = require('../utils/appError');

class SearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_USERNAME ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      } : null,
      maxRetries: 5,
      requestTimeout: 60000
    });

    this.indices = {
      courses: 'edtech_courses',
      users: 'edtech_users',
      lessons: 'edtech_lessons'
    };

    this.initializeIndices();
  }

  async initializeIndices() {
    for (const [name, index] of Object.entries(this.indices)) {
      try {
        const exists = await this.client.indices.exists({ index });
        
        if (!exists) {
          await this.createIndex(name, index);
        }
      } catch (error) {
        console.error(`Failed to initialize index ${index}:`, error);
      }
    }
  }

  async createIndex(type, index) {
    const mappings = this.getMappings(type);
    const settings = this.getSettings(type);
    
    await this.client.indices.create({
      index,
      body: {
        mappings: {
          properties: mappings
        },
        settings
      }
    });
  }

  getSettings(type) {
    const baseSettings = {
      number_of_shards: 3,
      number_of_replicas: 2,
      analysis: {
        analyzer: {
          autocomplete: {
            tokenizer: 'autocomplete',
            filter: ['lowercase', 'asciifolding']
          },
          search_analyzer: {
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding']
          }
        },
        tokenizer: {
          autocomplete: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 20,
            token_chars: ['letter', 'digit']
          }
        }
      }
    };

    if (type === 'courses') {
      return {
        ...baseSettings,
        analysis: {
          ...baseSettings.analysis,
          filter: {
            english_stop: {
              type: 'stop',
              stopwords: '_english_'
            },
            english_stemmer: {
              type: 'stemmer',
              language: 'english'
            }
          }
        }
      };
    }

    return baseSettings;
  }

  getMappings(type) {
    const baseMappings = {
      id: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      isPublished: { type: 'boolean' }
    };

    switch(type) {
      case 'courses':
        return {
          ...baseMappings,
          title: { 
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: { type: 'text', analyzer: 'autocomplete' },
              suggest: { type: 'completion' }
            },
            analyzer: 'standard',
            term_vector: 'with_positions_offsets'
          },
          description: { 
            type: 'text',
            analyzer: 'standard',
            term_vector: 'with_positions_offsets'
          },
          subtitle: { type: 'text' },
          category: { 
            type: 'object',
            properties: {
              id: { type: 'keyword' },
              name: { type: 'keyword' }
            }
          },
          instructor: {
            type: 'object',
            properties: {
              id: { type: 'keyword' },
              name: { type: 'text' }
            }
          },
          level: { type: 'keyword' },
          price: { type: 'float' },
          discountPrice: { type: 'float' },
          isFree: { type: 'boolean' },
          rating: { type: 'float' },
          totalEnrollments: { type: 'integer' },
          totalDuration: { type: 'integer' },
          totalLessons: { type: 'integer' },
          tags: { type: 'keyword' },
          language: { type: 'keyword' },
          whatYouWillLearn: { type: 'text' },
          requirements: { type: 'text' }
        };

      case 'users':
        return {
          ...baseMappings,
          email: { type: 'keyword' },
          firstName: { 
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: { type: 'text', analyzer: 'autocomplete' }
            }
          },
          lastName: { 
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: { type: 'text', analyzer: 'autocomplete' }
            }
          },
          fullName: { 
            type: 'text',
            copy_to: ['firstName', 'lastName']
          },
          role: { type: 'keyword' },
          expertise: { type: 'keyword' },
          bio: { type: 'text' },
          isActive: { type: 'boolean' }
        };

      case 'lessons':
        return {
          ...baseMappings,
          title: { 
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: { type: 'text', analyzer: 'autocomplete' }
            }
          },
          description: { type: 'text' },
          type: { type: 'keyword' },
          course: {
            type: 'object',
            properties: {
              id: { type: 'keyword' },
              title: { type: 'text' }
            }
          },
          section: { type: 'keyword' },
          duration: { type: 'integer' },
          isFree: { type: 'boolean' },
          content: { 
            type: 'object',
            enabled: false // Don't index content
          }
        };

      default:
        return baseMappings;
    }
  }

  async indexDocument(type, document) {
    try {
      const index = this.indices[type];
      const body = await this.prepareDocument(type, document);
      
      await this.client.index({
        index,
        id: document._id.toString(),
        body,
        refresh: 'wait_for'
      });

      return true;
    } catch (error) {
      console.error(`Failed to index ${type} document:`, error);
      return false;
    }
  }

  async bulkIndex(type, documents) {
    if (!documents || documents.length === 0) return { success: 0, failed: 0 };

    const index = this.indices[type];
    const operations = [];

    for (const doc of documents) {
      try {
        const body = await this.prepareDocument(type, doc);
        operations.push(
          { index: { _index: index, _id: doc._id.toString() } },
          body
        );
      } catch (error) {
        console.error(`Failed to prepare document ${doc._id}:`, error);
      }
    }

    if (operations.length === 0) return { success: 0, failed: 0 };

    const response = await this.client.bulk({ 
      operations,
      refresh: true 
    });

    const successful = response.items.filter(i => !i.index.error).length;
    const failed = response.items.filter(i => i.index.error).length;

    return { successful, failed };
  }

  async prepareDocument(type, doc) {
    const base = {
      id: doc._id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      isPublished: doc.isPublished
    };

    switch(type) {
      case 'courses':
        const instructor = await User.findById(doc.instructor).select('firstName lastName');
        const category = doc.category ? await Category.findById(doc.category) : null;

        return {
          ...base,
          title: doc.title,
          description: doc.description,
          subtitle: doc.subtitle,
          category: category ? {
            id: category._id,
            name: category.name
          } : null,
          instructor: instructor ? {
            id: instructor._id,
            name: `${instructor.firstName} ${instructor.lastName}`
          } : null,
          level: doc.level,
          price: doc.price,
          discountPrice: doc.discountPrice,
          isFree: doc.isFree,
          rating: doc.rating,
          totalEnrollments: doc.totalEnrollments,
          totalDuration: doc.totalDuration,
          totalLessons: doc.totalLessons,
          tags: doc.tags || [],
          language: doc.language,
          whatYouWillLearn: doc.whatYouWillLearn || [],
          requirements: doc.requirements || [],
          isPublished: doc.isPublished && doc.isApproved
        };

      case 'users':
        return {
          ...base,
          email: doc.email,
          firstName: doc.firstName,
          lastName: doc.lastName,
          fullName: `${doc.firstName} ${doc.lastName}`,
          role: doc.role,
          expertise: doc.expertise || [],
          bio: doc.bio,
          isActive: doc.isActive
        };

      case 'lessons':
        const course = await Course.findById(doc.course).select('title');
        
        return {
          ...base,
          title: doc.title,
          description: doc.description,
          type: doc.type,
          course: course ? {
            id: course._id,
            title: course.title
          } : null,
          section: doc.section,
          duration: doc.duration,
          isFree: doc.isFree,
          isPublished: doc.isPublished
        };

      default:
        return base;
    }
  }

  async search(type, query, filters = {}, pagination = { page: 1, limit: 10 }, options = {}) {
    const cacheKey = cacheService.generateKey(['search', type, query, JSON.stringify(filters), JSON.stringify(pagination)]);
    
    return cacheService.remember(cacheKey, 300, async () => {
      const index = this.indices[type];
      const { page, limit } = pagination;
      const from = (page - 1) * limit;

      const must = [];
      const filter = [];
      const should = [];

      // Text search with boosting
      if (query && query.trim()) {
        must.push({
          bool: {
            should: [
              // Exact matches with high boost
              {
                match_phrase: {
                  title: {
                    query,
                    boost: 5
                  }
                }
              },
              // Fuzzy matches
              {
                multi_match: {
                  query,
                  fields: [
                    'title^3',
                    'description^2',
                    'subtitle^2',
                    'tags^1.5',
                    'whatYouWillLearn^1',
                    'requirements^1'
                  ],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                  operator: 'or',
                  minimum_should_match: '70%'
                }
              },
              // Autocomplete matches
              {
                match: {
                  'title.autocomplete': {
                    query,
                    boost: 2
                  }
                }
              }
            ]
          }
        });
      }

      // Apply filters
      Object.entries(filters).forEach(([field, value]) => {
        if (value === undefined || value === null) return;

        if (field === 'category' && value) {
          filter.push({ term: { 'category.id': value } });
        } else if (field === 'instructor' && value) {
          filter.push({ term: { 'instructor.id': value } });
        } else if (field === 'price' && value) {
          if (value.min !== undefined || value.max !== undefined) {
            const range = {};
            if (value.min !== undefined) range.gte = value.min;
            if (value.max !== undefined) range.lte = value.max;
            filter.push({ range: { price: range } });
          }
        } else if (field === 'rating' && value) {
          filter.push({ range: { rating: { gte: value } } });
        } else if (Array.isArray(value)) {
          filter.push({ terms: { [field]: value } });
        } else if (typeof value === 'object') {
          const range = {};
          if (value.gt) range.gt = value.gt;
          if (value.gte) range.gte = value.gte;
          if (value.lt) range.lt = value.lt;
          if (value.lte) range.lte = value.lte;
          filter.push({ range: { [field]: range } });
        } else {
          filter.push({ term: { [field]: value } });
        }
      });

      // Add boosting for recent/popular content
      if (options.boostRecent) {
        should.push({
          range: {
            createdAt: {
              gte: 'now-30d',
              boost: 1.2
            }
          }
        });
      }

      if (options.boostPopular) {
        should.push({
          range: {
            totalEnrollments: {
              gte: 100,
              boost: 1.1
            }
          }
        });
      }

      const queryBody = {
        query: {
          bool: {
            must: must.length ? must : [{ match_all: {} }],
            filter,
            should: should.length ? should : undefined,
            minimum_should_match: should.length ? 1 : 0
          }
        },
        from,
        size: limit,
        highlight: {
          fields: {
            title: { 
              number_of_fragments: 1,
              fragment_size: 100
            },
            description: {
              number_of_fragments: 2,
              fragment_size: 150
            },
            subtitle: {
              number_of_fragments: 1,
              fragment_size: 100
            }
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>']
        },
        aggs: this.getAggregations(type),
        sort: this.getSortOptions(options.sortBy, options.sortOrder)
      };

      // Add suggestions if requested
      if (options.suggest) {
        queryBody.suggest = {
          title_suggest: {
            prefix: query,
            completion: {
              field: 'title.suggest',
              size: 5,
              fuzzy: {
                fuzziness: 2
              }
            }
          }
        };
      }

      const response = await this.client.search({
        index,
        body: queryBody
      });

      return {
        total: response.hits.total.value,
        results: response.hits.hits.map(hit => ({
          ...hit._source,
          score: hit._score,
          highlights: hit.highlight
        })),
        aggregations: response.aggregations,
        suggestions: response.suggest,
        page,
        limit,
        totalPages: Math.ceil(response.hits.total.value / limit)
      };
    });
  }

  getAggregations(type) {
    const baseAggs = {
      total: { value_count: { field: 'id' } }
    };

    switch(type) {
      case 'courses':
        return {
          categories: {
            terms: { field: 'category.name', size: 10 }
          },
          levels: {
            terms: { field: 'level', size: 10 }
          },
          priceRanges: {
            range: {
              field: 'price',
              ranges: [
                { key: 'free', to: 0 },
                { key: 'under_50', from: 0, to: 50 },
                { key: '50_to_100', from: 50, to: 100 },
                { key: '100_to_200', from: 100, to: 200 },
                { key: 'over_200', from: 200 }
              ]
            }
          },
          ratings: {
            range: {
              field: 'rating',
              ranges: [
                { key: '4+', from: 4 },
                { key: '3-4', from: 3, to: 4 },
                { key: '2-3', from: 2, to: 3 },
                { key: '1-2', from: 1, to: 2 },
                { key: 'under_1', to: 1 }
              ]
            }
          },
          languages: {
            terms: { field: 'language', size: 10 }
          },
          durations: {
            range: {
              field: 'totalDuration',
              ranges: [
                { key: 'under_1h', to: 60 },
                { key: '1-3h', from: 60, to: 180 },
                { key: '3-6h', from: 180, to: 360 },
                { key: '6-12h', from: 360, to: 720 },
                { key: 'over_12h', from: 720 }
              ]
            }
          }
        };

      default:
        return baseAggs;
    }
  }

  getSortOptions(sortBy, sortOrder = 'desc') {
    switch(sortBy) {
      case 'price_asc':
        return [{ price: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }];
      case 'rating':
        return [{ rating: 'desc' }, { totalEnrollments: 'desc' }];
      case 'popular':
        return [{ totalEnrollments: 'desc' }, { rating: 'desc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      case 'relevance':
      default:
        return [{ _score: 'desc' }, { rating: 'desc' }];
    }
  }

  async suggest(type, query, field = 'title', size = 5) {
    const index = this.indices[type];

    const response = await this.client.search({
      index,
      body: {
        suggest: {
          suggestions: {
            prefix: query,
            completion: {
              field: `${field}.suggest`,
              size,
              fuzzy: {
                fuzziness: 2
              },
              contexts: type === 'courses' ? {
                isPublished: ['true']
              } : undefined
            }
          }
        }
      }
    });

    return response.suggest.suggestions[0]?.options.map(option => ({
      text: option.text,
      score: option._score,
      source: option._source
    })) || [];
  }

  async deleteDocument(type, id) {
    try {
      const index = this.indices[type];
      
      await this.client.delete({
        index,
        id: id.toString(),
        refresh: 'wait_for'
      });

      return true;
    } catch (error) {
      console.error(`Failed to delete ${type} document:`, error);
      return false;
    }
  }

  async reindex(type) {
    let Model;
    let query = {};

    switch(type) {
      case 'courses':
        Model = Course;
        query = { isPublished: true, isDeleted: { $ne: true } };
        break;
      case 'users':
        Model = User;
        query = { isActive: true, isDeleted: { $ne: true } };
        break;
      case 'lessons':
        Model = Lesson;
        query = { isPublished: true, isDeleted: { $ne: true } };
        break;
      default:
        throw new AppError('Invalid type for reindexing', 400);
    }

    const documents = await Model.find(query).limit(1000); // Batch size
    const result = await this.bulkIndex(type, documents);
    
    return result;
  }

  async deleteIndex(type) {
    const index = this.indices[type];
    
    await this.client.indices.delete({ index });
    await this.createIndex(type, index);
  }
}

module.exports = new SearchService();
// const { Client } = require('@elastic/elasticsearch');
// const { Course, User, Lesson } = require('../models');

// class SearchService {
//   constructor() {
//     this.client = new Client({
//       node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
//     });

//     this.indices = {
//       courses: 'edtech_courses',
//       users: 'edtech_users',
//       lessons: 'edtech_lessons'
//     };
//   }

//   async initializeIndices() {
//     for (const [name, index] of Object.entries(this.indices)) {
//       const exists = await this.client.indices.exists({ index });
      
//       if (!exists) {
//         await this.createIndex(name, index);
//       }
//     }
//   }

//   async createIndex(type, index) {
//     const mappings = this.getMappings(type);
    
//     await this.client.indices.create({
//       index,
//       body: {
//         mappings: {
//           properties: mappings
//         },
//         settings: {
//           analysis: {
//             analyzer: {
//               autocomplete: {
//                 tokenizer: 'autocomplete',
//                 filter: ['lowercase']
//               }
//             },
//             tokenizer: {
//               autocomplete: {
//                 type: 'edge_ngram',
//                 min_gram: 2,
//                 max_gram: 10,
//                 token_chars: ['letter', 'digit']
//               }
//             }
//           }
//         }
//       }
//     });
//   }

//   getMappings(type) {
//     const baseMappings = {
//       id: { type: 'keyword' },
//       createdAt: { type: 'date' },
//       updatedAt: { type: 'date' }
//     };

//     switch(type) {
//       case 'courses':
//         return {
//           ...baseMappings,
//           title: { 
//             type: 'text',
//             fields: {
//               keyword: { type: 'keyword' },
//               autocomplete: { type: 'text', analyzer: 'autocomplete' }
//             }
//           },
//           description: { type: 'text' },
//           category: { type: 'keyword' },
//           instructor: { type: 'keyword' },
//           level: { type: 'keyword' },
//           price: { type: 'float' },
//           rating: { type: 'float' },
//           tags: { type: 'keyword' },
//           isPublished: { type: 'boolean' }
//         };

//       case 'users':
//         return {
//           ...baseMappings,
//           email: { type: 'keyword' },
//           firstName: { type: 'text' },
//           lastName: { type: 'text' },
//           role: { type: 'keyword' },
//           expertise: { type: 'keyword' }
//         };

//       case 'lessons':
//         return {
//           ...baseMappings,
//           title: { type: 'text' },
//           description: { type: 'text' },
//           type: { type: 'keyword' },
//           course: { type: 'keyword' }
//         };

//       default:
//         return baseMappings;
//     }
//   }

//   async indexDocument(type, document) {
//     const index = this.indices[type];
    
//     await this.client.index({
//       index,
//       id: document._id.toString(),
//       body: this.prepareDocument(type, document),
//       refresh: true
//     });
//   }

//   async bulkIndex(type, documents) {
//     const index = this.indices[type];
//     const operations = documents.flatMap(doc => [
//       { index: { _index: index, _id: doc._id.toString() } },
//       this.prepareDocument(type, doc)
//     ]);

//     const response = await this.client.bulk({ operations, refresh: true });
    
//     if (response.errors) {
//       console.error('Bulk index errors:', response.items.filter(i => i.index.error));
//     }

//     return response;
//   }

//   prepareDocument(type, doc) {
//     const base = {
//       id: doc._id,
//       createdAt: doc.createdAt,
//       updatedAt: doc.updatedAt
//     };

//     switch(type) {
//       case 'courses':
//         return {
//           ...base,
//           title: doc.title,
//           description: doc.description,
//           category: doc.category?.toString(),
//           instructor: doc.instructor?.toString(),
//           level: doc.level,
//           price: doc.price,
//           rating: doc.rating,
//           tags: doc.tags,
//           isPublished: doc.isPublished
//         };

//       case 'users':
//         return {
//           ...base,
//           email: doc.email,
//           firstName: doc.firstName,
//           lastName: doc.lastName,
//           role: doc.role
//         };

//       default:
//         return base;
//     }
//   }

//   async search(type, query, filters = {}, pagination = { page: 1, limit: 10 }) {
//     const index = this.indices[type];
//     const { page, limit } = pagination;
//     const from = (page - 1) * limit;

//     const must = [];
//     const filter = [];

//     // Text search
//     if (query) {
//       must.push({
//         multi_match: {
//           query,
//           fields: ['title^3', 'description^2', 'content'],
//           fuzziness: 'AUTO'
//         }
//       });
//     }

//     // Apply filters
//     Object.entries(filters).forEach(([field, value]) => {
//       if (value) {
//         if (Array.isArray(value)) {
//           filter.push({ terms: { [field]: value } });
//         } else if (typeof value === 'object') {
//           // Range filters
//           const range = {};
//           if (value.gt) range.gt = value.gt;
//           if (value.gte) range.gte = value.gte;
//           if (value.lt) range.lt = value.lt;
//           if (value.lte) range.lte = value.lte;
//           filter.push({ range: { [field]: range } });
//         } else {
//           filter.push({ term: { [field]: value } });
//         }
//       }
//     });

//     const response = await this.client.search({
//       index,
//       from,
//       size: limit,
//       body: {
//         query: {
//           bool: {
//             must: must.length ? must : [{ match_all: {} }],
//             filter
//           }
//         },
//         highlight: {
//           fields: {
//             title: {},
//             description: {},
//             content: {}
//           }
//         },
//         aggs: {
//           category_agg: { terms: { field: 'category' } },
//           level_agg: { terms: { field: 'level' } },
//           price_ranges: {
//             range: {
//               field: 'price',
//               ranges: [
//                 { to: 0, key: 'free' },
//                 { from: 0, to: 50, key: 'under_50' },
//                 { from: 50, to: 100, key: '50_to_100' },
//                 { from: 100, key: 'over_100' }
//               ]
//             }
//           }
//         }
//       }
//     });

//     return {
//       total: response.hits.total.value,
//       results: response.hits.hits.map(hit => ({
//         ...hit._source,
//         score: hit._score,
//         highlights: hit.highlight
//       })),
//       aggregations: response.aggregations,
//       page,
//       limit,
//       totalPages: Math.ceil(response.hits.total.value / limit)
//     };
//   }

//   async suggest(type, query, field = 'title') {
//     const index = this.indices[type];

//     const response = await this.client.search({
//       index,
//       body: {
//         suggest: {
//           suggestions: {
//             prefix: query,
//             completion: {
//               field: `${field}.autocomplete`,
//               size: 5,
//               fuzzy: {
//                 fuzziness: 2
//               }
//             }
//           }
//         }
//       }
//     });

//     return response.suggest.suggestions[0]?.options.map(option => ({
//       text: option.text,
//       score: option._score,
//       source: option._source
//     })) || [];
//   }

//   async deleteDocument(type, id) {
//     const index = this.indices[type];
    
//     await this.client.delete({
//       index,
//       id: id.toString()
//     });
//   }

//   async reindex(type) {
//     let Model;
//     switch(type) {
//       case 'courses':
//         Model = Course;
//         break;
//       case 'users':
//         Model = User;
//         break;
//       default:
//         throw new Error('Invalid type for reindexing');
//     }

//     const documents = await Model.find({ isDeleted: { $ne: true } });
//     await this.bulkIndex(type, documents);
    
//     return documents.length;
//   }
// }

// module.exports = new SearchService();