const { createCanvas, loadImage } = require('canvas');

// Inside your sock.ev.on('messages.upsert', async (m) => { ... })
// Add this inside the switch(command) area:

case command.startsWith('!announce') && command: 
  const leaderId = '212708892096@s.whatsapp.net'; // Your number, must match WhatsApp format
  
  if (msg.key.participant !== leaderId && msg.key.remoteJid !== leaderId) {
    await sock.sendMessage(sender, { text: '🚫 Only the Clan Leader can make announcements.' });
    return;
  }
  
  const announcementText = command.replace('!announce', '').trim();
  if (!announcementText) {
    await sock.sendMessage(sender, { text: '❗ Please provide a message.\nExample: !announce New season is coming! 🔥' });
    return;
  }

  const bg = await loadImage('./media/announcement_bg.png');
  const canvas = createCanvas(bg.width, bg.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(announcementText, canvas.width / 2, canvas.height / 2);

  const buffer = canvas.toBuffer('image/png');
  await sock.sendMessage(sender, { image: buffer, caption: '📢 New Announcement from Oisa Club Athletic!' });
  break;

const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

const { state, saveState } = useSingleFileAuthState('./auth.json');

const app = express();
const PORT = process.env.PORT || 3000;

const tournament = JSON.parse(fs.readFileSync('./tournament.json'));
const stats = JSON.parse(fs.readFileSync('./stats.json'));

async function startBot() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to', lastDisconnect.error, ', reconnecting', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot is connected!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

    // Welcome message for new participants
    if (msg.message?.protocolMessage?.type === 3) {
      const welcomeMsg = `🎉 *Welcome to Oisa Club Athletic!* 🎉\nGet ready for glory on the pitch! ⚽🏆`;
      await sock.sendMessage(sender, { text: welcomeMsg });
      await sock.sendMessage(sender, { video: fs.readFileSync('./media/welcome.gif'), gifPlayback: true });
    }

    // Commands handling
    if (messageContent) {
      const command = messageContent.toLowerCase();

      switch (command) {
        case '!help':
          await sock.sendMessage(sender, { text: `📜 *Oisa Club Bot Commands:*\n\n!help - Show commands\n!tournament - Current tournament info 🏆\n!fixtures - Show fixtures ⚽\n!stats - Player stats 📈` });
          break;

        case '!tournament':
          await sock.sendMessage(sender, { text: `🏆 *Current Tournament: ${tournament.name}*\n${tournament.description}` });
          await sock.sendMessage(sender, { video: fs.readFileSync('./media/tournament.gif'), gifPlayback: true });
          break;

        case '!fixtures':
          let fixtures = '📅 *Match Fixtures:*\n';
          tournament.fixtures.forEach((match, idx) => {
            fixtures += `\n${idx + 1}. ${match}`;
          });
          await sock.sendMessage(sender, { text: fixtures });
          break;

        case '!stats':
          let statsMsg = '📈 *Player Stats:*\n';
          stats.players.forEach(player => {
            statsMsg += `\n⚽ ${player.name}: ${player.goals} goals, ${player.wins} wins`;
          });
          await sock.sendMessage(sender, { text: statsMsg });
          await sock.sendMessage(sender, { video: fs.readFileSync('./media/stats.gif'), gifPlayback: true });
          break;

        default:
          break;
      }
    }
  });
}

startBot();

app.get('/', (req, res) => {
  res.send('Oisa Club Athletic Bot is running! ⚽');
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
