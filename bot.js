const telegramAuthToken = ''; // Telegram bot authentication token
const webhookEndpoint = '/endpoint'; // Webhook endpoint path
const oneSecMailApiUrl = 'https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1'; // API URL for generating temporary email addresses
const availableDomains = ['1secmail.com', '1secmail.net', '1secmail.org']; // Available domains for temporary email
let tempEmail = ''; // Variable to store the generated temporary email
let emailExpiry = null; // Variable to store email expiration (not used in this code)

// Event listener for incoming HTTP requests
addEventListener('fetch', event => {
  event.respondWith(handleIncomingRequest(event));
});

// Handler function for processing incoming HTTP requests
async function handleIncomingRequest(event) {
  const url = new URL(event.request.url);
  const path = url.pathname;
  const method = event.request.method;
  const workerUrl = `${url.protocol}//${url.host}`;

  if (method === 'POST' && path === webhookEndpoint) {
    const update = await event.request.json();
    event.waitUntil(processUpdate(update)); // Asynchronously process the Telegram update
    return new Response('Ok');
  } else if (method === 'GET' && path === '/configure-webhook') {
    return await configureWebhook(workerUrl);
  } else {
    return new Response('Not found', { status: 404 });
  }
}

// Function to configure the Telegram webhook
async function configureWebhook(workerUrl) {
  const url = `https://api.telegram.org/bot${telegramAuthToken}/setWebhook?url=${workerUrl}${webhookEndpoint}`;
  const response = await fetch(url);

  if (response.ok) {
    return new Response('Webhook set successfully', { status: 200 });
  } else {
    return new Response('Failed to set webhook', { status: response.status });
  }
}

// Function to process incoming Telegram updates
async function processUpdate(update) {
  if ('message' in update) {
    const chatId = update.message.chat.id;
    const userText = update.message.text.toLowerCase().trim();

    switch (true) {
      case userText === '/start':
        await sendMessage(chatId, 'Welcome to ZsecMail ✉\n\nWhy ZsecMail?\n\nWe provide you secure 🔐 fast 🔥 reliable disposable mail service\n\nYou can use the following command:\n/generate_email - Generate a temporary email address\n\nThank You 🙏');
        break;

      case userText.startsWith('/generate_email'):
        await handleGenerateEmail(chatId, userText);
        break;

      case userText === '/fetchmail':
        await handleFetchMail(chatId);
        break;

      case userText.startsWith('/delete_email'):
        await handleDeleteEmail(chatId, userText);
        break;

      case userText.startsWith('/search'):
        await handleSearchEmails(chatId, userText);
        break;

      default:
        await sendMessage(chatId, 'Unknown command. Please use /start to see available commands.');
        break;
    }
  }
}

// Function to handle /generate_email command
async function handleGenerateEmail(chatId, userText) {
  const domain = userText.split(' ')[1] || '1secmail.com';

  if (!availableDomains.includes(domain)) {
    await sendMessage(chatId, `Invalid domain. Available domains are: ${availableDomains.join(', ')}`);
    return;
  }

  const emailResponse = await fetch(`${oneSecMailApiUrl}&domain=${domain}`);
  if (emailResponse.ok) {
    const emailData = await emailResponse.json();
    tempEmail = emailData[0];
    const emailLink = `https://www.1secmail.com/mailbox/${tempEmail.split('@')[0]}/${tempEmail.split('@')[1]}`;
    await sendMessage(chatId, `Your temporary email address is: ${tempEmail}\n\nYou can view your email [here](${emailLink})\n\nor click /fetchmail`, 'Markdown');
  } else {
    await sendMessage(chatId, 'Failed to generate temporary email address');
  }
}

// Function to handle /fetchmail command
async function handleFetchMail(chatId) {
  if (!tempEmail) {
    await sendMessage(chatId, 'Please generate an email address first using /generate_email command.');
    return;
  }

  const emailResponse = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${tempEmail.split('@')[0]}&domain=${tempEmail.split('@')[1]}`);
  if (emailResponse.ok) {
    const emailData = await emailResponse.json();
    if (emailData.length > 0) {
      const messages = emailData.map(message => `From: ${message.from}\nSubject: ${message.subject}\nBody: ${message.body}`).join('\n\n');
      await sendMessage(chatId, messages);
    } else {
      await sendMessage(chatId, 'No emails found.');
    }
  } else {
    await sendMessage(chatId, 'Failed to fetch emails');
  }
}

// Function to handle /delete_email command
async function handleDeleteEmail(chatId, userText) {
  const emailNumber = parseInt(userText.split(' ')[1], 10);

  if (!tempEmail) {
    await sendMessage(chatId, 'Please generate an email address first using /generate_email command.');
    return;
  }

  if (!emailNumber) {
    await sendMessage(chatId, 'Please provide the number of the email you want to delete.');
    return;
  }

  const emailResponse = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${tempEmail.split('@')[0]}&domain=${tempEmail.split('@')[1]}`);
  if (emailResponse.ok) {
    const emailData = await emailResponse.json();
    if (emailData[emailNumber - 1]) {
      const deleteResponse = await fetch(`https://www.1secmail.com/api/v1/?action=deleteMessage&login=${tempEmail.split('@')[0]}&domain=${tempEmail.split('@')[1]}&id=${emailData[emailNumber - 1].id}`);
      if (deleteResponse.ok) {
        await sendMessage(chatId, 'Email deleted successfully.');
      } else {
        await sendMessage(chatId, 'Failed to delete email.');
      }
    } else {
      await sendMessage(chatId, 'Invalid email number.');
    }
  } else {
    await sendMessage(chatId, 'Failed to fetch emails for deletion.');
  }
}

// Function to handle /search command
async function handleSearchEmails(chatId, userText) {
  const [command, searchQuery] = userText.split(' ', 2);

  if (!tempEmail) {
    await sendMessage(chatId, 'Please generate an email address first using /generate_email command.');
    return;
  }

  if (!searchQuery) {
    await sendMessage(chatId, 'Please provide a search query.');
    return;
  }

  const emailResponse = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${tempEmail.split('@')[0]}&domain=${tempEmail.split('@')[1]}`);
  if (emailResponse.ok) {
    const emailData = await emailResponse.json();
    const filteredEmails = emailData.filter(email =>
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filteredEmails.length > 0) {
      const messages = filteredEmails.map(email => `From: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body}`).join('\n\n');
      await sendMessage(chatId, messages);
    } else {
      await sendMessage(chatId, 'No emails found matching the search query.');
    }
  } else {
    await sendMessage(chatId, 'Failed to search emails.');
  }
}

// Utility function to send messages via Telegram API
async function sendMessage(chatId, text, parseMode = null) {
  const url = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
  if (parseMode) {
    await fetch(`${url}&parse_mode=${parseMode}`);
  } else {
    await fetch(url);
  }
}
