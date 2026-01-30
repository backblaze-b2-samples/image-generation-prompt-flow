export type SSEController = {
  send: (event: string, data: unknown) => void;
  close: () => void;
};

export function createSSEStream(): {
  stream: ReadableStream;
  controller: SSEController;
} {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
    },
  });

  const send = (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    streamController.enqueue(encoder.encode(message));
  };

  const close = () => {
    streamController.close();
  };

  return { stream, controller: { send, close } };
}

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
