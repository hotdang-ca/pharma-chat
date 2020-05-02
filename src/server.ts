import express, { Application } from "express";
import socketIO, { Server as SocketIOServer } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import path from "path";

interface User {
    socketId: string;
    role: 'client'|'pharmacy'|undefined;
}

export class Server {
    private httpServer: HTTPServer;
    private app: Application;
    private io: SocketIOServer;
    private activeSockets: User[] = [];
    
    private readonly DEFAULT_PORT = 5000;
    
    constructor() {
        this.initialize();
        
        this.configureRoutes();
        this.handleSocketConnection();
    }
    
    private configureApp(): void {
        this.app.use(express.static(path.join(__dirname, "../public")));
    }

    private initialize(): void {
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = socketIO(this.httpServer);

        this.configureApp();
        this.handleSocketConnection();
    }
    
    private configureRoutes(): void {
        this.app.get("/", (req, res) => {
            res.sendFile("index.html");
        });
    }
    
    private handleSocketConnection(): void {
        this.io.on("connection", (socket) => {
            const existingSocket = this.activeSockets.find((existingSocket) => {
                return existingSocket.socketId === socket.id;
            });
          
            if (!existingSocket) {
                this.activeSockets.push({
                    socketId: socket.id,
                    role: undefined,
                });
            }
       
            socket.on('role', (roleData: any) => {
                console.log(`A new ${roleData.role} connected with id ${roleData.socketId}`);

                const { role, socketId } = roleData;

                const user = {
                    role,
                    socketId,    
                };
                
                this.activeSockets.forEach((user) => {
                    if (user.socketId === socketId) {
                        user.role = role;
                    }
                });

                socket.emit("update-user-list", {
                    users: this.activeSockets.filter((existingSocket) => {
                        return existingSocket.socketId !== socketId;
                    }),
                });

                socket.broadcast.emit("update-user-list", {
                    users: [user]
                });
            });

            socket.on("call-user", (data: any) => {
                socket.to(data.to).emit("call-made", {
                    offer: data.offer,
                    socket: socket.id
                });
            });

            socket.on("make-answer", data => {
                socket.to(data.to).emit("answer-made", {
                    socket: socket.id,
                    answer: data.answer
                });
            });

            socket.on("reject-call", data => {
                socket.to(data.from).emit("call-rejected", {
                    socket: socket.id
                });
            });

            socket.on("disconnect", () => {
                this.activeSockets = this.activeSockets.filter(
                    (existingSocket) => existingSocket.socketId !== socket.id
                );
                socket.broadcast.emit("remove-user", {
                    socketId: socket.id
                });
            });
        });
    }
    
    public listen(callback: (port: number) => void): void {
        this.httpServer.listen(this.DEFAULT_PORT, () =>
            callback(this.DEFAULT_PORT)
        );
    }
}