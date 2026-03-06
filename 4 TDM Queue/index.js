// ================================
//  NeatQueue Logger Bot (16-Player)
// ================================
import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import 'dotenv/config';

// ----------------
// CONFIG VALUES
// ----------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN_BOT6;  // Update this env var name
const NEATQUEUE_API_KEY = process.env.NEATQUEUE_API_KEY;
const QUEUE_ID = "1461474834725732385";  // Update with new queue ID
const MATCH_ID = "1381807913563324466";  // Update if different
const UPDATE_INTERVAL_MS = 10000;
const LOG_CHANNEL_ID = "1437635073179517019";  // Update with channel ID
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

    if (Object.keys(data).length === 0) return 0;

    // Only count matches that belong to THIS queue
    return Object.values(data).filter(
      match => match.queue_channel_id === QUEUE_ID
    ).length;

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
    console.log(`⏭️ No changes (${count}/16, Active Queues: ${activeCount})`);
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
    nickname = `${count}/16 In Queue`;
  } else {
    nickname = `${activeCount} Active (${count}/16 Next)`;
  }
  
  // Create progress bar for status (8 blocks, each represents 2 players)
  const filledBlocks = Math.floor(count / 2); // Each block = 2 players
  const emptyBlocks = 8 - filledBlocks;
  
  let progressBar;
  if (activeCount === 0) {
    // No active queue: green for filled, gray for empty
    const filledSquares = '🟩'.repeat(filledBlocks);
    const emptySquares = '⬜'.repeat(emptyBlocks);
    progressBar = filledSquares + emptySquares;
  } else if (activeCount === 1) {
    // 1 active queue: all green + yellow for next queue
    const yellowSquares = '🟨'.repeat(filledBlocks);
    const greenSquares = '🟩'.repeat(emptyBlocks);
    progressBar = yellowSquares + greenSquares;
  } else if (activeCount === 2) {
    // 2 active queues: all yellow + red for next queue
    const redSquares = '🟧'.repeat(filledBlocks);
    const yellowSquares = '🟨'.repeat(emptyBlocks);
    progressBar = redSquares + yellowSquares;
  } else {
    // 3+ active queues: all red + purple for next queue
    const purpleSquares = '🟥'.repeat(filledBlocks);
    const redSquares = '🟧'.repeat(emptyBlocks);
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
      const message = `📊 **Queue Update:**\n- Players in Queue: ${count}/16\n- Progress: ${progressBar}\n- Active Queues: ${activeCount}\n- Bot Status: ${onlineStatus}`;
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
