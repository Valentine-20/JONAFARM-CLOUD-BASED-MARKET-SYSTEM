import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import session from 'express-session';
import crypto from 'crypto'; // ES module fixed

dotenv.config();

const app = express();
const PORT = 3000;

const __dirname = path.resolve();

// ---------------------------
// MIDDLEWARE
// ---------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'john-farm-secret',
  resave: false,
  saveUninitialized: true
}));

// ---------------------------
// FILE PATHS
// ---------------------------
const productsFile = path.join(__dirname, 'data', 'products.json');
const farmersFile = path.join(__dirname, 'data', 'farmers.json');
const ordersFile = path.join(__dirname, 'data', 'orders.json');
const usersFile = path.join(__dirname, 'data', 'users.json');
const distributorsFile = path.join(__dirname, 'data', 'distributors.json');
const adminsFile = path.join(__dirname, 'data', 'admins.json');
const productBlockchainFile = path.join(__dirname, 'data', 'productBlockchain.json');

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------
// PRODUCTS ROUTES
// ---------------------------
app.get('/products', (req, res) => {
  try {
    const data = fs.existsSync(productsFile) ? fs.readFileSync(productsFile, 'utf-8') : '[]';
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ message: 'Error reading products file', error: err.message });
  }
});

app.post('/products/add', (req, res) => {
  const { name, price_ksh, quantity, unit, image } = req.body;
  if (!name || !price_ksh || !quantity || !unit || !image) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    const products = fs.existsSync(productsFile) ? JSON.parse(fs.readFileSync(productsFile, 'utf-8')) : [];
    const newProduct = {
      id: products.length + 1,
      name,
      price_ksh,
      quantity,
      unit,
      image,
      verified: false
    };
    products.push(newProduct);
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

    // Blockchain: record product addition
    createProductBlock({ action: 'Add Product', product: newProduct });

    res.status(201).json({ message: 'Product added successfully', product: newProduct });
  } catch (err) {
    res.status(500).json({ message: 'Error adding product', error: err.message });
  }
});

app.post('/products/verify', (req, res) => {
  const { name } = req.body;
  try {
    const products = fs.existsSync(productsFile) ? JSON.parse(fs.readFileSync(productsFile, 'utf-8')) : [];
    const product = products.find(p => p.name === name);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.verified = true;
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

    // Blockchain: record verification
    createProductBlock({ action: 'Verify Product', product: product.name });

    res.json({ message: 'Product verified successfully', product });
  } catch (err) {
    res.status(500).json({ message: 'Error verifying product', error: err.message });
  }
});

app.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  try {
    const products = fs.existsSync(productsFile) ? JSON.parse(fs.readFileSync(productsFile, 'utf-8')) : [];
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Product not found' });
    const removed = products.splice(index, 1)[0];
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

    // Blockchain: record deletion
    createProductBlock({ action: 'Delete Product', product: removed.name });

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product', error: err.message });
  }
});

app.patch('/products/update/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, price_ksh, quantity, unit, image } = req.body;

  try {
    const products = fs.existsSync(productsFile) ? JSON.parse(fs.readFileSync(productsFile, 'utf-8')) : [];
    const product = products.find(p => p.id === id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.name = name || product.name;
    product.price_ksh = price_ksh || product.price_ksh;
    product.quantity = quantity || product.quantity;
    product.unit = unit || product.unit;
    if (image) product.image = image;

    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

    // Blockchain: record update
    createProductBlock({ action: 'Update Product', product: product.name });

    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
});

// ---------------------------
// FARMERS ROUTES
// ---------------------------
app.get('/farmers', (req, res) => {
  try {
    const data = fs.existsSync(farmersFile) ? fs.readFileSync(farmersFile, 'utf-8') : '[]';
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ message: 'Error reading farmers file', error: err.message });
  }
});

app.post('/farmers/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const farmers = fs.existsSync(farmersFile) ? JSON.parse(fs.readFileSync(farmersFile, 'utf-8')) : [];
    const farmer = farmers.find(f => f.username === username && f.password === password);
    if (!farmer) return res.status(401).json({ message: 'Invalid username or password' });
    req.session.farmer = farmer;
    res.json({ message: 'Login successful', farmer });
  } catch (err) {
    res.status(500).json({ message: 'Error reading farmers file', error: err.message });
  }
});

// ---------------------------
// ADMIN ROUTES
// ---------------------------
app.post('/admins/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

  try {
    const admins = fs.existsSync(adminsFile) ? JSON.parse(fs.readFileSync(adminsFile, 'utf-8')) : [];
    const admin = admins.find(a => a.username === username && a.password === password);
    if (!admin) return res.status(401).json({ message: 'Invalid admin credentials' });

    req.session.admin = admin;
    res.json({ message: 'Login successful', admin });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ---------------------------
// DISTRIBUTORS ROUTES
// ---------------------------
app.post('/distributors/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  try {
    const distributors = fs.existsSync(distributorsFile) ? JSON.parse(fs.readFileSync(distributorsFile, 'utf-8')) : [];
    const distributor = distributors.find(d => d.username === username && d.password === password);
    if (!distributor) return res.status(401).json({ message: 'Invalid username or password' });
    req.session.distributor = distributor;
    res.json({ message: 'Login successful', distributor });
  } catch (err) {
    console.error('Distributor login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ---------------------------
// USERS ROUTES
// ---------------------------
app.post('/users/signup', (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password) return res.status(400).json({ message: 'All fields required' });
  try {
    const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, 'utf-8')) : [];
    if (users.find(u => u.email === email)) return res.status(400).json({ message: 'Email already registered' });
    const newUser = { name, phone, email, password, role: 'buyer', status: 'Active' };
    users.push(newUser);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    res.status(201).json({ message: 'Signup successful', user: newUser });
  } catch (err) {
    res.status(500).json({ message: 'Error signing up', error: err.message });
  }
});

app.post('/users/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, 'utf-8')) : [];
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    req.session.user = user;
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
});

// ---------------------------
// ORDERS ROUTES
// ---------------------------
app.post('/orders/place', (req, res) => {
  const { product, quantity, buyer, phone, address, farmer, order_date } = req.body;
  if (!product || !quantity || !buyer || !phone || !address || !farmer)
    return res.status(400).json({ message: 'Missing required fields' });
  try {
    const orders = fs.existsSync(ordersFile) ? JSON.parse(fs.readFileSync(ordersFile, 'utf-8')) : [];
    const newOrder = {
      id: orders.length + 1,
      product,
      quantity,
      buyer,
      phone,
      address,
      status: 'Pending',
      farmer,
      distributor: '',
      order_date
    };
    orders.push(newOrder);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    res.status(201).json({ message: 'Order placed successfully', order: newOrder });
  } catch (err) {
    res.status(500).json({ message: 'Error placing order', error: err.message });
  }
});

app.get('/orders', (req, res) => {
  try {
    const orders = fs.existsSync(ordersFile) ? JSON.parse(fs.readFileSync(ordersFile, 'utf-8')) : [];
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error reading orders', error: err.message });
  }
});

app.get('/orders/farmer/:farmer', (req, res) => {
  const farmerName = req.params.farmer;
  try {
    const orders = fs.existsSync(ordersFile) ? JSON.parse(fs.readFileSync(ordersFile, 'utf-8')) : [];
    const farmerOrders = orders.filter(o => o.farmer === farmerName);
    res.json(farmerOrders);
  } catch (err) {
    res.status(500).json({ message: 'Error reading orders for farmer', error: err.message });
  }
});

app.get('/orders/distributor', (req, res) => {
  try {
    const orders = fs.existsSync(ordersFile) ? JSON.parse(fs.readFileSync(ordersFile, 'utf-8')) : [];
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error reading orders for distributor', error: err.message });
  }
});

app.post('/orders/distributor/update', (req, res) => {
  const { id, status, distributor } = req.body;
  if (!id || !status || !distributor) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const orders = fs.existsSync(ordersFile) ? JSON.parse(fs.readFileSync(ordersFile, 'utf-8')) : [];
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.status = status;
    order.distributor = distributor;
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    res.json({ message: 'Order status updated successfully', order });
  } catch (err) {
    res.status(500).json({ message: 'Error updating order', error: err.message });
  }
});

// ---------------------------
// BLOCKCHAIN FUNCTIONS
// ---------------------------
function createProductBlock(action) {
  let chain = [];
  if (fs.existsSync(productBlockchainFile)) {
    chain = JSON.parse(fs.readFileSync(productBlockchainFile, 'utf-8'));
  }

  const previousHash = chain.length ? chain[chain.length - 1].hash : '0';
  const index = chain.length + 1;
  const timestamp = new Date().toISOString();
  const blockData = { index, timestamp, productAction: action, previousHash };
  const hash = crypto.createHash('sha256').update(JSON.stringify(blockData)).digest('hex');
  const newBlock = { ...blockData, hash };

  chain.push(newBlock);
  fs.writeFileSync(productBlockchainFile, JSON.stringify(chain, null, 2));
  return newBlock;
}

function getProductBlockchain() {
  if (!fs.existsSync(productBlockchainFile)) return [];
  return JSON.parse(fs.readFileSync(productBlockchainFile, 'utf-8'));
}

// ---------------------------
// START SERVER
// ---------------------------
app.listen(PORT, () => {
  console.log(`🚜 JonaFarm Market server running at http://localhost:${PORT}`);
});

// ---------------------------
// PRODUCT BLOCKCHAIN ROUTE
// ---------------------------
app.get('/blockchain/products', (req, res) => {
  try {
    const chain = getProductBlockchain();
    res.json(chain);
  } catch (err) {
    res.status(500).json({ message: 'Error reading product blockchain', error: err.message });
  }
});
