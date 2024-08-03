const telegramAuthToken = '';
const webhookEndpoint = '/endpoint';
const oneSecMailApiUrl = 'https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1';
const availableDomains = ['1secmail.com', '1secmail.net', '1secmail.org'];
let tempEmail = '';
let emailExpiry = null;

addEventListener('fetch', event => {
  event.respondWith(handleIncomingRequest(event));
});

async function handleIncomingRequest(event) {
  let url = new URL(event.request.url);
  let path = url.pathname;
  let method = event.request.method;
  let workerUrl = `${url.protocol}//${url.host}`;

  if (method === 'POST' && path === webhookEndpoint) {
    const update = await event.request.json();
    event.waitUntil(processUpdate(update));
    return new Response('Ok');
  } else if (method === 'GET' && path === '/configure-webhook') {
    const url = `https://api.telegram.org/bot${telegramAuthToken}/setWebhook?url=${workerUrl}${webhookEndpoint}`;

    const response = await fetch(url);

    if (response.ok) {
      return new Response('Webhook set successfully', { status: 200 });
    } else {
      return new Response('Failed to set webhook', { status: response.status });
    }
  } else {
    return new Response('Not found', { status: 404 });
  }
}

async function processUpdate(update) {
  if ('message' in update) {
    const chatId = update.message.chat.id;
    const userText = update.message.text;

    // Check if the user sent the /start command
    if (userText.toLowerCase().trim() === '/start') {
      const responseText = 'Welcomee to ZsecMail ✉\n\nWhy ZsecMail?\n\nWe provide you secure 🔐 fast 🔥 reliable disposable mail service\n\nYou can use the following command:\n/generate_email - Generate a temporary email address\n\nThank You 🙏';
      const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
      await fetch(telegramApiUrl);
    }

    // Check if the user wants to generate a temporary email address
    else if (userText.toLowerCase().startsWith('/generate_email')) {
      const domain = userText.split(' ')[1] || '1secmail.com';

      if (!availableDomains.includes(domain)) {
        const responseText = `Invalid domain. Available domains are: ${availableDomains.join(', ')}`;
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
        return;
      }

      const emailResponse = await fetch(`https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1&domain=${domain}`);
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        tempEmail = emailData[0];
        const emailLink = `https://www.1secmail.com/mailbox/${tempEmail.split('@')[0]}/${tempEmail.split('@')[1]}`;
        const responseText = `Your temporary email address is: ${tempEmail}\n\nYou can view your email [here](${emailLink})\n\nor click /fetchmail`;
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}&parse_mode=Markdown`;
        await fetch(telegramApiUrl);
      } else {
        const responseText = 'Failed to generate temporary email address';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
      }
    }

    // Check if the user wants to fetch emails
    else if (userText.toLowerCase().trim() === '/fetchmail') {
      if (!tempEmail) {
        const responseText = 'Please generate an email address first using /generate_email command.';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
        return;
      }
      const emailResponse = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${tempEmail.split('@')[0]}&domain=${tempEmail.split('@')[1]}`);
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        if (emailData.length > 0) {
          const messages = emailData.map(message => `From: ${message.from}\nSubject: ${message.subject}\nBody: ${message.body}`).join('\n\n');
          const responseText = messages;
          const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
          await fetch(telegramApiUrl);
        } else {
          const responseText = 'No emails found.';
          const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
          await fetch(telegramApiUrl);
        }
      } else {
        const responseText = 'Failed to fetch emails';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
      }
    }

    // Handle email deletion
    else if (userText.toLowerCase().startsWith('/delete_email')) {
      const emailNumber = parseInt(userText.split(' ')[1], 10);

      if (!tempEmail) {
        const responseText = 'Please generate an email address first using /generate_email command.';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
        return;
      }

      if (!emailNumber) {
        const responseText = 'Please provide the number of the email you want to delete.';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
        return;
      }

      const emailResponse = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${tempEmail.split('@')[0]}&domain=${tempEmail.split('@')[1]}`);
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        if (emailData[emailNumber - 1]) {
          const deleteResponse = await fetch(`https://www.1secmail.com/api/v1/?action=deleteMessage&login=${tempEmail.split('@')[0]}&domain=${tempEmail.split('@')[1]}&id=${emailData[emailNumber - 1].id}`);
          if (deleteResponse.ok) {
            const responseText = 'Email deleted successfully.';
            const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
            await fetch(telegramApiUrl);
          } else {
            const responseText = 'Failed to delete email.';
            const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
            await fetch(telegramApiUrl);
          }
        } else {
          const responseText = 'Invalid email number.';
          const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
          await fetch(telegramApiUrl);
        }
      } else {
        const responseText = 'Failed to fetch emails for deletion.';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
      }
    }

    // Handle advanced search
    else if (userText.toLowerCase().startsWith('/search')) {
      const [command, searchQuery] = userText.split(' ', 2);

      if (!tempEmail) {
        const responseText = 'Please generate an email address first using /generate_email command.';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
        return;
      }

      if (!searchQuery) {
        const responseText = 'Please provide a search query.';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
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
          const responseText = messages;
          const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
          await fetch(telegramApiUrl);
        } else {
          const responseText = 'No emails found matching the search query.';
          const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
          await fetch(telegramApiUrl);
        }
      } else {
        const responseText = 'Failed to fetch emails for search.';
        const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
        await fetch(telegramApiUrl);
      }
    }

    // Check if the user wants developer info
    else if (userText.toLowerCase().trim() === '/info') {
      const responseText = 'Developer: Surajit Sen\nContact: getsensurajit@gmail.com';
      const telegramApiUrl = `https://api.telegram.org/bot${telegramAuthToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
      await fetch(telegramApiUrl);
    }
  }
}
