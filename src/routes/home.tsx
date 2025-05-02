import { html } from 'hono/html';

const page = () => (
  <html>
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>PDF OCR Chat</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center">
      <div class="w-full max-w-md mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 class="text-2xl font-bold mb-4 text-center">PDF OCR Chat</h1>
        <div id="chat-message" class="mb-4 min-h-[2rem] text-gray-700"></div>
        <form id="chat-form" class="flex gap-2" autocomplete="off">
          <input
            id="chat-input"
            type="text"
            class="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            placeholder="Type your message..."
            required
          />
          <button
            type="submit"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Send
          </button>
        </form>
      </div>
      {html`
<script>
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const messageDiv = document.getElementById('chat-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  messageDiv.textContent = '';
  input.value = '';
  input.disabled = true;

  const res = await fetch('/autorag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (res.headers.get('content-type')?.includes('text/event-stream')) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        // Append all 'data:' lines in the chunk
        chunk.split('\n').forEach(line => {
          if (line.startsWith('data:')) {
            messageDiv.textContent += line.slice(5).trim();
          }
        });
      }
    }
  } else {
    // fallback: not a stream
    const data = await res.json();
    messageDiv.textContent = typeof data === 'string' ? data : (data?.answer || JSON.stringify(data));
  }
  input.disabled = false;
  input.focus();
});
</script>
      `}
    </body>
  </html>
);

export default (c: any) => c.html(page({}));
