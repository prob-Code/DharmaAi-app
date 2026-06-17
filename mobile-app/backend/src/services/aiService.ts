interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function getChatCompletion(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model || "llama-3.3-70b-versatile",
      messages: params.messages,
      temperature: 0.7,
      max_tokens: 250
    })
  });

  const data = (await response.json()) as GroqResponse;

  if (!response.ok || data.error) {
    const message = data.error?.message || `Groq error: ${response.status}`;
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = response.status || 502;
    throw err;
  }

  return data.choices?.[0]?.message?.content || "";
}
