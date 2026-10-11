require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({
    origin: '*'
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'painflame-backend' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Painflame backend listening on port ${port}`);
});
