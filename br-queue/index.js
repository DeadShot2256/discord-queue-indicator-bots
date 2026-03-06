// ================================
//  NeatQueue Logger Bot
// ================================
import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import 'dotenv/config';

// ----------------
// CONFIG VALUES
// ----------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const NEATQUEUE_API_KEY = process.env.NEATQUEUE_API_KEY;
const QUEUE_ID = "1429676494501711922";
const MATCH_ID = "1381807913563324466";
const UPDATE_INTERVAL_MS = 10000;
const LOG_CHANNEL_ID = "1437635073179517019";
const GUILD_ID = "1381807913563324466";

// ----------------
// DISCORD CLIENT
// ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Track previous state to only update on changes
let previousCount = null;
let previousActiveCount = null;

// ----------------
// API CALLS
// ----------------
async function getQueuePlayerCount() {
  try {
    const response = await fetch(
      `https://api.neatqueue.com/api/v1/queue/${QUEUE_ID}/players`,
      {
        headers: {
          "Authorization": NEATQUEUE_API_KEY,
          "Accept": "application/json"
        }
      }
    );
    if (!response.ok) {
      console.error(`❌ NeatQueue Players Error: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return Array.isArray(data.players) ? data.players.length : 0;
  } catch (err) {
    console.error("❌ Fetch Error (players):", err);
    return null;
  }
}

async function getActiveQueueCount() {
  try {
    const response = await fetch(
      `https://api.neatqueue.com/api/v1/matches/${MATCH_ID}`,
      {
        headers: {
          "Authorization": NEATQUEUE_API_KEY,
          "Accept": "application/json"
        }
      }
    );
    if (!response.ok) {
      console.error(`❌ NeatQueue Match Error: ${response.status}`);
      return 0;
    }
    const data = await response.json();
    
    // Check if response is empty object (no active queue)
    if (Object.keys(data).length === 0) {
      return 0;
    }
    
    // Count how many times the QUEUE_ID appears in the response
    return Object.keys(data).length;
    
  } catch (err) {
    console.error("❌ Fetch Error (match):", err);
    return 0;
  }
}

// ----------------
// UPDATE NICKNAME & LOG
// ----------------
async function updateQueueInfo() {
  console.log("🔄 Checking queue status...");
  
  const count = await getQueuePlayerCount();
  
  if (count === null) {
    console.log("⚠️ Skipping update (API unavailable)");
    return;
  }

  const activeCount = await getActiveQueueCount();
  
  // Check if anything changed
  const hasChanged = (count !== previousCount || activeCount !== previousActiveCount);
  
  if (!hasChanged) {
    console.log(`⏭️ No changes (${count}/8, Active Queues: ${activeCount})`);
    return;
  }
  
  console.log(`📊 Change detected! Count: ${previousCount} → ${count}, Active Queues: ${previousActiveCount} → ${activeCount}`);
  
  // Update previous state
  previousCount = count;
  previousActiveCount = activeCount;
  
  // Determine if bot should be online or offline
  const shouldBeOnline = activeCount > 0 || count > 0;
  
  // Determine nickname based on queue status
  let nickname;
  if (activeCount === 0) {
    nickname = `${count}/8 In Queue`;
  } else {
    nickname = `${activeCount} Active (${count}/8 Next)`;
  }
  
  // Create progress bar for status
  let progressBar;
  if (activeCount === 0) {
    // No active queue: green for filled, gray for empty
    const filledSquares = '🟩'.repeat(count);
    const emptySquares = '⬜'.repeat(8 - count);
    progressBar = filledSquares + emptySquares;
  } else if (activeCount === 1) {
    // 1 active queue: all green + yellow for next queue
    const yellowSquares = '🟨'.repeat(count);
    const greenSquares = '🟩'.repeat(8 - count);
    progressBar = yellowSquares + greenSquares;
  } else if (activeCount === 2) {
    // 2 active queues: all yellow + red for next queue
    const redSquares = '🟧'.repeat(count);
    const yellowSquares = '🟨'.repeat(8 - count);
    progressBar = redSquares + yellowSquares;
  } else {
    // 3+ active queues: all red + purple for next queue
    const purpleSquares = '🟥'.repeat(count);
    const redSquares = '🟧'.repeat(8 - count);
    progressBar = purpleSquares + redSquares;
  }

  // Update bot status (online/offline)
  try {
    if (shouldBeOnline) {
      client.user.setStatus('online');
      console.log('✅ Bot status: ONLINE');
    } else {
      client.user.setStatus('invisible');
      console.log('⚫ Bot status: OFFLINE (invisible)');
    }
  } catch (err) {
    console.error(`❌ Failed to update status: ${err.message}`);
  }

  // Update bot presence (custom status with progress bar)
  try {
    client.user.setPresence({
      activities: [{
        name: progressBar,
        type: 4 // Type 4 is "Custom Status"
      }]
    });
    console.log(`✅ Custom status updated: ${progressBar}`);
  } catch (err) {
    console.error(`❌ Failed to update presence: ${err.message}`);
  }

  // Update bot nickname
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const botMember = await guild.members.fetchMe();
    await botMember.setNickname(nickname);
    console.log(`✅ Nickname updated: ${nickname}`);
  } catch (err) {
    console.error(`❌ Failed to update nickname: ${err.message}`);
  }

  // Log to channel
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      const onlineStatus = shouldBeOnline ? "Online 🟢" : "Offline ⚫";
      const message = `📊 **Queue Update:**\n- Players in Queue: ${count}/8\n- Progress: ${progressBar}\n- Active Queues: ${activeCount}\n- Bot Status: ${onlineStatus}`;
      await channel.send(message);
      console.log("✅ Logged to channel");
    }
  } catch (err) {
    console.error(`❌ Failed to send message: ${err.message}`);
  }
}

// ----------------
// READY EVENT
// ----------------
client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`⏱ Checking queue every ${UPDATE_INTERVAL_MS / 1000} seconds (updates only on change)`);
  
  updateQueueInfo(); // first run
  setInterval(updateQueueInfo, UPDATE_INTERVAL_MS);
});

// ----------------
// START BOT
// ----------------
client.login(DISCORD_TOKEN);
