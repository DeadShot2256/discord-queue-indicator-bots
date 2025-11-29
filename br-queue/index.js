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
let previousActive = null;

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

async function isActiveQueue() {
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
      return false;
    }
    const data = await response.json();
    
    // Check if response is empty object (no active queue)
    if (Object.keys(data).length === 0) {
      return false;
    }
    
    // Check if the queue ID exists in the response
    const responseText = JSON.stringify(data);
    return responseText.includes(QUEUE_ID);
  } catch (err) {
    console.error("❌ Fetch Error (match):", err);
    return false;
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

  const isActive = await isActiveQueue();
  
  // Check if anything changed
  const hasChanged = (count !== previousCount || isActive !== previousActive);
  
  if (!hasChanged) {
    console.log(`⏭️ No changes (${count}/8, Active: ${isActive})`);
    return;
  }
  
  console.log(`📊 Change detected! Count: ${previousCount} → ${count}, Active: ${previousActive} → ${isActive}`);
  
  // Update previous state
  previousCount = count;
  previousActive = isActive;
  
  // Determine if bot should be online or offline
  const shouldBeOnline = isActive || count > 0;
  
  // Determine nickname based on queue status
  const nickname = isActive ? `Active - ${count}/8 Next` : `${count}/8 In Queue`;
  
  // Create progress bar for status (green squares for filled, gray for empty)
  const filledSquares = '🟩'.repeat(count);
  const emptySquares = '⬜'.repeat(8 - count);
  const progressBar = filledSquares + emptySquares;

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
      const statusEmoji = isActive ? "✅" : "❌";
      const onlineStatus = shouldBeOnline ? "Online 🟢" : "Offline ⚫";
      const message = `📊 **Queue Update:**\n- Players in Queue: ${count}/8\n- Progress: ${progressBar}\n- Active Queue: ${isActive ? "Yes" : "No"} ${statusEmoji}\n- Bot Status: ${onlineStatus}`;
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
