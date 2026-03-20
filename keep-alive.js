const axios = require('axios');
const https = require('https');

class KeepAlive {
  constructor(renderUrl) {
    this.renderUrl = renderUrl;
    this.pingCount = 0;
    this.failureCount = 0;
    this.isRunning = false;
  }

  // Method to ping the server
  async pingServer() {
    try {
      const startTime = Date.now();
      
      const response = await axios.get(this.renderUrl, {
        timeout: 10000,
        httpsAgent: new https.Agent({ keepAlive: true }),
        headers: {
          'User-Agent': 'Keep-Alive-Service/1.0',
          'Keep-Alive': 'true'
        }
      });
      
      const responseTime = Date.now() - startTime;
      this.pingCount++;
      
      console.log(`[${new Date().toISOString()}] ✅ Ping #${this.pingCount} successful`);
      console.log(`   Status: ${response.status} | Time: ${responseTime}ms`);
      console.log(`   Uptime: ${this.getUptime()}`);
      
      this.failureCount = 0;
      return true;
      
    } catch (error) {
      this.failureCount++;
      
      console.log(`[${new Date().toISOString()}] ❌ Ping failed (Attempt ${this.failureCount})`);
      
      if (error.code === 'ECONNABORTED') {
        console.log('   Error: Request timeout');
      } else if (error.response) {
        console.log(`   Error: Server responded with ${error.response.status}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
      
      // If failed 3 times in a row, try more aggressive pinging
      if (this.failureCount >= 3) {
        console.log('⚠️ Multiple failures detected - Switching to aggressive mode');
        this.aggressivePing();
      }
      
      return false;
    }
  }

  // Aggressive ping when server is down
  async aggressivePing() {
    for (let i = 0; i < 5; i++) {
      try {
        await axios.get(this.renderUrl, { timeout: 5000 });
        console.log(`✅ Server recovered after aggressive ping #${i + 1}`);
        this.failureCount = 0;
        break;
      } catch (e) {
        console.log(`   Aggressive ping #${i + 1} failed`);
        await this.sleep(2000);
      }
    }
  }

  // Get uptime percentage
  getUptime() {
    const totalPings = this.pingCount + this.failureCount;
    if (totalPings === 0) return '100%';
    const uptime = ((this.pingCount / totalPings) * 100).toFixed(2);
    return `${uptime}%`;
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Start the keep-alive service
  start(intervalMinutes = 5) {
    if (this.isRunning) {
      console.log('Keep-alive service is already running');
      return;
    }
    
    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    console.log(`🚀 Keep-alive service started`);
    console.log(`📡 Pinging: ${this.renderUrl}`);
    console.log(`⏱️  Interval: Every ${intervalMinutes} minutes`);
    console.log(`🕒 Started at: ${new Date().toLocaleString()}`);
    console.log('----------------------------------------');
    
    // Ping immediately
    this.pingServer();
    
    // Then ping at intervals
    setInterval(() => {
      this.pingServer();
    }, intervalMs);
  }
}

// Configuration
const RENDER_URL = 'https://your-render-app.onrender.com'; // Replace with your actual URL
const PING_INTERVAL = 5; // minutes

// Create and start the service
const keepAlive = new KeepAlive(RENDER_URL);
keepAlive.start(PING_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Keep-alive service stopped');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\n👋 Keep-alive service terminated');
  process.exit();
});