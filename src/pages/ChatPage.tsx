import { Menu } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ChatMessage } from "~/components/ChatMessage";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import ollama from "ollama";
import { ThoughtMessage } from "~/components/ThoughtMessage";
import { db } from "~/lib/dexie";
import { useParams } from "react-router";
import { threadId } from "worker_threads";
import { useLiveQuery } from "dexie-react-hooks";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const ChatPage = () => {

  const [streamMessage, setStreamMessage] = useState("")
  const [streamThoughts, setStreamThoughts] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const scrollToBottomRef = useRef<HTMLDivElement>(null)

  const params = useParams()
  const messages = useLiveQuery(() => db.getMessagesFromThread(params.threadId as string), [params.threadId])
  let sentPrompt = ""

  const handleSubmit = async () => {
    sentPrompt = messageInput;
    setMessageInput("")
    await db.createMessage({
      content: sentPrompt,
      role: "user",
      thought: "",
      thread_id: params.threadId as string
    })

    const stream = await ollama.chat({
      model: "deepseek-r1:1.5b",
      messages: [{
        role: "user",
        content: sentPrompt.trim(),
      },
      ],
      // stream: false
      stream: true
    });

    setMessageInput("")

    let fullContent = ""
    let fullThought = ""
    let outputMode: "think" | "respoonse" = "think";

    for await (const part of stream) {
      const messageContent = part.message.content
      if (outputMode === "think") {
        if(!(messageContent.includes("<think>") || messageContent.includes("</think>"))){
          fullThought += messageContent
          setStreamThoughts(fullThought)
        }

        if (messageContent.includes("</think>")) {
          outputMode = "respoonse"
        }
      } else {
        fullContent += messageContent
        setStreamMessage(fullContent + messageContent)
      }
    }

    await db.createMessage({
      content: fullContent,
      role: "assistant",
      thought: fullThought,
      thread_id: params.threadId as string}
    )
  };

  const handleScrollToBottom = () => {
    scrollToBottomRef.current?.scrollIntoView()
  }

  useLayoutEffect(() => {
    handleScrollToBottom();
  }, [streamMessage, streamThoughts, messages])

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center px-4 h-16 border-b">
        <h1 className="text-xl font-bold ml-4">AI Chat Dashboard</h1>
      </header>
      <main className="flex-1 overflow-auto p-4 w-full">
        <div className="mx-auto space-y-4 pb-20 max-w-screen-md">
          {messages?.map((message, index) => (
            <>
              {message.role === "assistant" ? <ThoughtMessage thought={message.thought}/> : "" }
              <ChatMessage
                key={index}
                role={message.role}
                content={message.content}
              />
            </>
          ))}

          <div ref={scrollToBottomRef}></div>
        </div>
      </main>
      <footer className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            className="flex-1"
            placeholder="Type your message here..."
            rows={5}
            value={messageInput}
            onChange={(e) => { setMessageInput(e.target.value) }}
          />
          <Button onClick={handleSubmit} type="button">
            Send
          </Button>
        </div>
      </footer>
    </div>
  )
}

export default ChatPage;