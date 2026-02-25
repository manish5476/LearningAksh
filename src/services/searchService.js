const { Client } = require('@elastic/elasticsearch');
const { Course, User, Lesson } = require('../models');

class SearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
    });

    this.indices = {
      courses: 'edtech_courses',
      users: 'edtech_users',
      lessons: 'edtech_lessons'
    };
  }

  async initializeIndices() {
    for (const [name, index] of Object.entries(this.indices)) {
      const exists = await this.client.indices.exists({ index });
      
      if (!exists) {
        await this.createIndex(name, index);
      }
    }
  }

  async createIndex(type, index) {
    const mappings = this.getMappings(type);
    
    await this.client.indices.create({
      index,
      body: {
        mappings: {
          properties: mappings
        },
        settings: {
          analysis: {
            analyzer: {
              autocomplete: {
                tokenizer: 'autocomplete',
                filter: ['lowercase']
              }
            },
            tokenizer: {
              autocomplete: {
                type: 'edge_ngram',
                min_gram: 2,
                max_gram: 10,
                token_chars: ['letter', 'digit']
              }
            }
          }
        }
      }
    });
  }

  getMappings(type) {
    const baseMappings = {
      id: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' }
    };

    switch(type) {
      case 'courses':
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
          category: { type: 'keyword' },
          instructor: { type: 'keyword' },
          level: { type: 'keyword' },
          price: { type: 'float' },
          rating: { type: 'float' },
          tags: { type: 'keyword' },
          isPublished: { type: 'boolean' }
        };

      case 'users':
        return {
          ...baseMappings,
          email: { type: 'keyword' },
          firstName: { type: 'text' },
          lastName: { type: 'text' },
          role: { type: 'keyword' },
          expertise: { type: 'keyword' }
        };

      case 'lessons':
        return {
          ...baseMappings,
          title: { type: 'text' },
          description: { type: 'text' },
          type: { type: 'keyword' },
          course: { type: 'keyword' }
        };

      default:
        return baseMappings;
    }
  }

  async indexDocument(type, document) {
    const index = this.indices[type];
    
    await this.client.index({
      index,
      id: document._id.toString(),
      body: this.prepareDocument(type, document),
      refresh: true
    });
  }

  async bulkIndex(type, documents) {
    const index = this.indices[type];
    const operations = documents.flatMap(doc => [
      { index: { _index: index, _id: doc._id.toString() } },
      this.prepareDocument(type, doc)
    ]);

    const response = await this.client.bulk({ operations, refresh: true });
    
    if (response.errors) {
      console.error('Bulk index errors:', response.items.filter(i => i.index.error));
    }

    return response;
  }

  prepareDocument(type, doc) {
    const base = {
      id: doc._id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };

    switch(type) {
      case 'courses':
        return {
          ...base,
          title: doc.title,
          description: doc.description,
          category: doc.category?.toString(),
          instructor: doc.instructor?.toString(),
          level: doc.level,
          price: doc.price,
          rating: doc.rating,
          tags: doc.tags,
          isPublished: doc.isPublished
        };

      case 'users':
        return {
          ...base,
          email: doc.email,
          firstName: doc.firstName,
          lastName: doc.lastName,
          role: doc.role
        };

      default:
        return base;
    }
  }

  async search(type, query, filters = {}, pagination = { page: 1, limit: 10 }) {
    const index = this.indices[type];
    const { page, limit } = pagination;
    const from = (page - 1) * limit;

    const must = [];
    const filter = [];

    // Text search
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['title^3', 'description^2', 'content'],
          fuzziness: 'AUTO'
        }
      });
    }

    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          filter.push({ terms: { [field]: value } });
        } else if (typeof value === 'object') {
          // Range filters
          const range = {};
          if (value.gt) range.gt = value.gt;
          if (value.gte) range.gte = value.gte;
          if (value.lt) range.lt = value.lt;
          if (value.lte) range.lte = value.lte;
          filter.push({ range: { [field]: range } });
        } else {
          filter.push({ term: { [field]: value } });
        }
      }
    });

    const response = await this.client.search({
      index,
      from,
      size: limit,
      body: {
        query: {
          bool: {
            must: must.length ? must : [{ match_all: {} }],
            filter
          }
        },
        highlight: {
          fields: {
            title: {},
            description: {},
            content: {}
          }
        },
        aggs: {
          category_agg: { terms: { field: 'category' } },
          level_agg: { terms: { field: 'level' } },
          price_ranges: {
            range: {
              field: 'price',
              ranges: [
                { to: 0, key: 'free' },
                { from: 0, to: 50, key: 'under_50' },
                { from: 50, to: 100, key: '50_to_100' },
                { from: 100, key: 'over_100' }
              ]
            }
          }
        }
      }
    });

    return {
      total: response.hits.total.value,
      results: response.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score,
        highlights: hit.highlight
      })),
      aggregations: response.aggregations,
      page,
      limit,
      totalPages: Math.ceil(response.hits.total.value / limit)
    };
  }

  async suggest(type, query, field = 'title') {
    const index = this.indices[type];

    const response = await this.client.search({
      index,
      body: {
        suggest: {
          suggestions: {
            prefix: query,
            completion: {
              field: `${field}.autocomplete`,
              size: 5,
              fuzzy: {
                fuzziness: 2
              }
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
    const index = this.indices[type];
    
    await this.client.delete({
      index,
      id: id.toString()
    });
  }

  async reindex(type) {
    let Model;
    switch(type) {
      case 'courses':
        Model = Course;
        break;
      case 'users':
        Model = User;
        break;
      default:
        throw new Error('Invalid type for reindexing');
    }

    const documents = await Model.find({ isDeleted: { $ne: true } });
    await this.bulkIndex(type, documents);
    
    return documents.length;
  }
}

module.exports = new SearchService();