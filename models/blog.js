const mongoose = require('mongoose');
const URLslugs = require('mongoose-url-slugs');

const blogSchema = mongoose.Schema({
    title: {
        type: String
    },
    slug: {
        type: String
    },
    body: {
        type: String
    },
    thumbnail: {
        type: String,
    },
    author: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    }
})

blogSchema.plugin(URLslugs("title", { field: 'slug' }));

const Blog = mongoose.model('Blog', blogSchema);

module.exports = { Blog };