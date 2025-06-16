require('dotenv').config();
const express = require('express');
const http = require('http');
const amqp = require('amqplib');
const WebSocket = require('ws');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const {
  PORT,
  RABBITMQ_HOST,
  RABBITMQ_PORT,
  RABBITMQ_VHOST,
  RABBITMQ_USER,
  RABBITMQ_PASS,
  QUEUE_NAME,
  MINIO_URL,
  MINIO_PORT,
  MINIO_BUCKET,
  MINIO_BASE_PATH,
  MINIO_ROOT_USER,
  MINIO_ROOT_PASSWORD
} = process.env;

// Configuração do cliente S3 para o MinIO
const s3 = new AWS.S3({
  accessKeyId: MINIO_ROOT_USER,
  secretAccessKey: MINIO_ROOT_PASSWORD,
  endpoint: `http://${MINIO_URL}:${MINIO_PORT}`,
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

function generatePresignedUrl(key) {
  return s3.getSignedUrl('getObject', {
    Bucket: MINIO_BUCKET,
    Key: key,
    Expires: 300
  });
}

// Histórico salvo em arquivo JSON
const historyFile = path.join(__dirname, 'alert-history.json');
if (!fs.existsSync(historyFile)) {
  fs.writeFileSync(historyFile, '[]', 'utf-8');
}

// Servir arquivos da pasta pública
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para deletar áudio após reprodução
app.get('/delete', (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).send('Arquivo não informado');

  const key = `${MINIO_BASE_PATH}/${file}`;

  s3.deleteObject({ Bucket: MINIO_BUCKET, Key: key }, (err) => {
    if (err) {
      console.error("❌ Erro ao deletar:", err);
      return res.status(500).send('Erro ao deletar');
    }
    console.log("✅ Áudio deletado após reprodução:", key);
    res.send('OK');
  });
});

// Endpoint para retornar o histórico completo
app.get('/api/history', (req, res) => {
  const data = fs.readFileSync(historyFile, 'utf-8');
  res.json(JSON.parse(data));
});

// Endpoint para retornar estatísticas agregadas
app.get('/api/stats', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));

    const stats = {
      total: data.length,
      porNivel: {},
      porCategoria: {}
    };

    data.forEach(alerta => {
      const nivel = alerta.level || 'desconhecido';
      const categoria = alerta.category || 'sem-categoria';

      stats.porNivel[nivel] = (stats.porNivel[nivel] || 0) + 1;
      stats.porCategoria[categoria] = (stats.porCategoria[categoria] || 0) + 1;
    });

    res.json(stats);
  } catch (err) {
    console.error("Erro ao gerar estatísticas:", err);
    res.status(500).send('Erro ao gerar estatísticas');
  }
});

// WebSocket: envio de alertas em tempo real
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket conectado!');
});

// Conecta e escuta a fila do RabbitMQ
async function startConsumer() {
  const connURL = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}:${RABBITMQ_PORT}/${RABBITMQ_VHOST}`;
  const conn = await amqp.connect(connURL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE_NAME, { durable: true });

  console.log(`🟢 Escutando a fila: ${QUEUE_NAME}`);

  ch.consume(QUEUE_NAME, (msg) => {
    if (msg !== null) {
      const payload = JSON.parse(msg.content.toString());
      const key = `${MINIO_BASE_PATH}/${payload.file}`;
      const fileUrl = generatePresignedUrl(key);
      payload.audioUrl = fileUrl;
      payload.receivedAt = new Date().toISOString();

      // Salva no histórico
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      history.push(payload);
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
      console.log("📝 Alerta registrado no histórico");

      // Envia para todos os clientes conectados
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payload));
        }
      });

      ch.ack(msg);
    }
  });
}

startConsumer().catch(console.error);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
});
