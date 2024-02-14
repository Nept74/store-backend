const express = require('express');
const axios = require('axios');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const mongoose = require('mongoose');
require('dotenv').config()

const app = express();
mongoose.connect(`mongodb+srv://apanasovm74:${process.env.MONGODB_PASSWORD}@cluster0.mxv9br9.mongodb.net`,
  { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Ошибка подключения к MongoDB:'));
db.once('open', async () => {
  console.log('Успешное подключение к MongoDB Atlas');
  
  try {
    const response = await axios.post(
      'https://cpb-new-developer.myshopify.com/admin/api/2023-10/graphql.json',
      {
        query: `
          query {
            products(first: 10) {
              edges {
                node {
                  id
                  bodyHtml
                  images(first: 1) {
                    edges {
                      node {
                        src
                      }
                    }
                  }
                }
              }
            }
          }
        `,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': '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',
        },
      }
    );

    // Обработка данных и сохранение только уникальных продуктов в базе данных
    const products = response.data.data.products.edges.map((edge) => ({
      id: edge.node.id,
      bodyHtml: edge.node.bodyHtml,
      imageSrc: edge.node.images.edges[0].node.src,
    }));
    for (const product of products) {
      const existingProduct = await Product.findOne({ id: product.id });
      if (!existingProduct) {
        await Product.create(product);
      }
    }

    console.log('Данные о продуктах успешно сохранены в MongoDB');
  } catch (error) {
    console.error('Ошибка получения данных о продуктах:', error);
  }
});
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const schema = buildSchema(`
  type Product {
    id: ID!
    bodyHtml: String!
    imageSrc: String!
  }

  type Query {
    products: [Product]!
  }
`);

const root = {
  products: async () => {
    try {
      const products = await Product.find();
      return products;
    } catch (error) {
      console.error('Ошибка получения данных о продуктах:', error);
      throw new Error('Ошибка получения данных о продуктах');
    }
  },
};

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    console.error('Ошибка получения данных о продуктах:', error);
    res.status(500).json({ error: 'Ошибка получения данных о продуктах' });
  }
});

const Product = mongoose.model('Product', {
  id: String,
  bodyHtml: String,
  imageSrc: String,
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

