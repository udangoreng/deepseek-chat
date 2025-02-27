import Dexie, {Table} from 'dexie';

interface DEX_Thread{
    id: string;
    title: string;
    created_at: Date;
    updated_at: Date;
}

interface DEX_Message{
    id: string;
    role: "user" | "assistant";
    content: string;
    thought: string
    created_at: Date;
    thread_id: string;
}

class ChatDB extends Dexie {
    threads!: Table<DEX_Thread>;
    messages!: Table<DEX_Message>;

    constructor(){
        super("chatdb");
        this.version(1).stores({
            threads: "id, title, created_at, updated_at",
            messages: "id, role, content, thought, created_at, thread_id"
        })

        this.threads.hook("creating", (_, obj)=>{
            obj.created_at = new Date();
            obj.updated_at = new Date();
        })

        this.messages.hook("creating", (_, obj)=>{
            obj.created_at = new Date();
        })
    }

    async createThreads(title: string){
        const id = crypto.randomUUID();

        await this.threads.add({
            id,
            title,
            created_at: new Date(),
            updated_at: new Date()
        });

        return id;
    }

    async getAllThreads(){
        return this.threads.reverse().sortBy("update_at");
    }

    async createMessage(message: Pick<DEX_Message, "content" | "role" | "thread_id" | "thought">){
        const messageID = crypto.randomUUID()
        await this.transaction("rw", [this.threads, this.messages], async () => {
            await this.messages.add({
                ...message,
                id: messageID,
                created_at: new Date()
            })

            await this.threads.update(message.thread_id, {
                updated_at : new Date(),
            })
        })

        return messageID;
    }

    async getMessagesFromThread(threadId: string){
        return this.messages.where("thread_id").equals(threadId).sortBy("created_at");
    }
}

export const db = new ChatDB();