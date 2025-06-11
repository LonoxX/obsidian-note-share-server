# 🔐 Obsidian Note Share Server



A secure, zero-knowledge backend server for the [Obsidian Secure Note Share Plugin](https://github.com/LonoxX/obsidian-note-share-plugin). This server stores encrypted notes that can only be decrypted by users with the proper decryption tokens.



## 🌟 What is this server?



This Node.js backend server provides secure storage for encrypted Obsidian notes shared via the [Obsidian Secure Note Share Plugin](https://github.com/LonoxX/obsidian-note-share-plugin).



**💡 Why self-host?** While the plugin works with our hosted service out-of-the-box, running your own server gives you:

- **Complete control** over your data
- **Custom configuration** options
- **Private infrastructure** for sensitive content
- **No third-party dependencies**
**🔗 Works with**: [Obsidian Secure Note Share Plugin](https://github.com/LonoxX/obsidian-note-share-plugin)



## ✨ Features

- **🔒 Zero-Knowledge Storage** - Server cannot read encrypted content
- **⏰ Automatic Cleanup** - Expired shares are automatically deleted
- **🛡️ Security Headers** - Helmet.js for secure HTTP headers
- **🚦 Rate Limiting** - Protection against abuse and spam
- **📊 CORS Support** - Configurable cross-origin resource sharing for the plugin
- **🐳 Docker Ready** - Easy deployment with Docker and Docker Compose
- **📝 File Storage** - Simple JSON-based storage (easily replaceable)
- **🔄 Health Checks** - Built-in health monitoring endpoint
- **📦 Minimal Dependencies** - Lightweight and secure
- **⚙️ Environment Configuration** - Flexible config via environment variables
- **🌐 Modern Web UI** - Beautiful interface for shared notes with dark/light mode



## 📥 Installation

### Option 1: Docker Compose (Recommended)

1. **Clone the repository:**

```bash
 git clone https://github.com/LonoxX/obsidian-note-share-server
 cd obsidian-note-share-server
```



2. **Start with Docker Compose:**

```bash
docker-compose up -d
```



3. **Check logs:**

```bash
docker-compose logs -f
```



4. **Stop the server:**

```bash
docker-compose down
```



### Option 2: Docker



1. **Build the image:**

```bash
docker build -t obsidian-note-share-server .
```



2. **Run the container:**

```bash
docker run -d \
--name obsidian-note-share \
-p 3000:3000 \
-v $(pwd)/storage:/app/storage \
-e NODE_ENV=production \
obsidian-note-share-server
```



### Option 3: Manual Installation



1. **Prerequisites:**
   - Node.js (version 16 or higher)
   - npm


2. **Clone and install:**

```bash
git clone https://github.com/LonoxX/obsidian-note-share-server
cd obsidian-note-share-server
npm install
```



3. **Configure environment (optional):**

```bash
cp .env.example .env
```



4. **Start the server:**

```bash
# Development
npm run dev
# Production
npm start
```


5. **Configure the plugin:**
   - Install the [Obsidian Secure Note Share Plugin](https://github.com/LonoxX/obsidian-note-share-plugin)
   - Set the server URL to your server address (e.g., `http://localhost:3000`)



## ⚙️ Configuration
### Environment Variables

Create a `.env` file or set environment variables:


```bash
# Server Configuration
PORT=3000
NODE_ENV=production
# Storage
STORAGE_PATH=./storage

# Time-to-Live Settings
DEFAULT_TTL_MINUTES=60
MAX_TTL_MINUTES=10080
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
# Cleanup
CLEANUP_INTERVAL_MINUTES=10
# Security
CORS_ORIGINS=*,app://obsidian.md,capacitor://localhost
MAX_CONTENT_SIZE=10mb
```




## 🚀 Usage
### Starting the Server


```bash
# Development with auto-reload
npm run dev

# Production

npm start

# With Docker Compose
docker-compose up -d
```

### API Endpoints

#### Upload Encrypted Note

```http

POST /upload

Content-Type: application/json
{
  "encryptedContent": {
    "data": "encrypted_data_string",
    "iv": "initialization_vector",
    "tag": "authentication_tag"
  },
  "ttlMinutes": 60,
  "oneTimeView": false,
  "hasPassword": false
}
```

#### Retrieve Encrypted Note

```http
GET /note/:shareId
```
#### View Shared Note (Web Interface)

```http
GET /share/:shareId?token=decryption_token
```
#### Delete Share

```http
DELETE /revoke/:shareId
```
#### Health Check

```http
GET /health
```



### Client Configuration



Configure your Obsidian plugin to point to this server:

1. Open Obsidian Settings
2. Go to **Community plugins** → **Secure Note Share**
3. Set **Server URL** to your server address (e.g., `http://localhost:3000`)



## 🔒 Security

### Zero-Knowledge Architecture

1. **Client-Side Encryption**: Notes are encrypted in the Obsidian plugin before being sent
2. **No Plaintext Storage**: Server only stores encrypted data
3. **Separate Token Management**: Decryption tokens never reach the server
4. **Minimal Metadata**: Only essential information (expiry, flags) is stored



## 🐳 Docker Deployment

### Production Docker Compose

```yaml
services:
  secure-note-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - STORAGE_PATH=/app/storage
      - DEFAULT_TTL_MINUTES=60
      - MAX_TTL_MINUTES=10080
      - CLEANUP_INTERVAL_MINUTES=10
      - RATE_LIMIT_MAX_REQUESTS=100
      - MAX_CONTENT_SIZE=10mb
    volumes:
      - storage_data:/app/storage
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
volumes:
  storage_data:
    driver: local
```



### Reverse Proxy with Nginx



```nginx
server {
    listen 443 ssl;
    server_name notes.yourdomain.com;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```



### API Testing



```bash
# Test health endpoint
curl http://localhost:3000/health
# Upload test (requires proper encrypted payload)
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: application/json" \
  -d '{"encryptedContent":{"data":"test","iv":"test","tag":"test"},"ttlMinutes":60}'
```



## 📊 Monitoring



### Health Checks



The server provides a health endpoint at `/health` that returns:



```json

{

  "status": "healthy",

  "timestamp": "2025-01-01T12:00:00.000Z",

  "uptime": 3600,

  "storage": "accessible"

}

```

### Getting Help
- 📚 Check the [plugin documentation](https://github.com/LonoxX/obsidian-note-share-plugin)
- 🐞 Report issues on [GitHub Issues](https://github.com/LonoxX/obsidian-note-share-server/issues)
- 💬 Join discussions on [GitHub Discussions](https://github.com/LonoxX/obsidian-note-share-server/discussions)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---



**Made for the [Obsidian Secure Note Share Plugin](https://github.com/LonoxX/obsidian-note-share-plugin)** 🔗
