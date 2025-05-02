import { html } from 'hono/html';

const page = (props: { message?: string }) => (
  <html>
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>PDF OCR Chat</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center">
      <div {...{"x-data": "chatApp()"}} class="w-full max-w-md mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 class="text-2xl font-bold mb-4 text-center">PDF OCR Chat</h1>
        <div class="mb-4 min-h-[2rem] text-gray-700" {...{"x-text": "message"}}></div>
        <form {...{"x-on:submit.prevent": "sendMessage"}} class="flex gap-2">
          <input
            type="text"
            class="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
            placeholder="Type your message..."
            {...{"x-model": "input"}}
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
          function chatApp() {
            return {
              input: '',
              message: '',
              async sendMessage() {
                if (!this.input) return;
                this.message = '';
                const res = await fetch('/autorag', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: this.input })
                });
                if (res.headers.get('content-type')?.includes('text/event-stream')) {
                  const reader = res.body.getReader();
                  const decoder = new TextDecoder();
                  let done = false;
                  let buffer = '';
                  while (!done) {
                    const { value, done: doneReading } = await reader.read();
                    done = doneReading;
                    if (value) {
                      buffer += decoder.decode(value, { stream: true });
                      // Split on newlines for SSE
                      let parts = buffer.split(/\n+/);
                      buffer = parts.pop() || '';
                      for (const part of parts) {
                        if (part.startsWith('data:')) {
                          this.message += part.slice(5).trim();
                        }
                      }
                    }
                  }
                  this.input = '';
                  return;
                }
                // fallback: not a stream
                const data = await res.json();
                this.message = typeof data === 'string' ? data : (data?.answer || JSON.stringify(data));
                this.input = '';
              }
            }
          }
        </script>
      `}
    </body>
  </html>
);

export default (c: any) => c.html(page({}));
