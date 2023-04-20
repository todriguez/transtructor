const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '/')));

// Add this function to handle key pair generation
async function generateKeyPairHandler(req, res) {
  // Add your code to generate a key pair here
  // Send the key pair data in the response
  res.json({
    public_key: 'generated_public_key',
    private_key: 'generated_private_key',
  });
}

// Add this function to handle mining
async function mineHandler(req, res) {
  const selectedIndex = req.params.index;

  // Add your code to mine 110 blocks to the address with selectedIndex
  // Send the mined data in the response
  res.json([
    // Add the mined data here
  ]);
}

// Define the routes and their handlers
app.post('/api/generate-keypair', generateKeyPairHandler);
app.post('/api/mine/:index', mineHandler);

app.use(
  '/rpc',
  createProxyMiddleware({
    target: 'http://localhost:18332',
    pathRewrite: { '^/rpc': '' },
    changeOrigin: true,
    auth: 'bitcoin:bitcoin',
  }),
);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
