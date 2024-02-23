#! /usr/bin/env node
const { spawn, exec } = require('child_process');
const fs = require('fs');
const ws = require('ws');

let randomWebsocketPort =  Math.floor(Math.random() * 1000) + 9000;

let dataFromLocalFile = null;

try {
    dataFromLocalFile = fs.readFileSync('.roboport', 'utf8');
}
catch (e) {}


randomWebsocketPort = dataFromLocalFile ? JSON.parse(dataFromLocalFile).port : randomWebsocketPort;
console.log("Started a websocket server on port: ", randomWebsocketPort);

// write the port to a file
fs.writeFileSync('.roboport',JSON.stringify( {
    port: randomWebsocketPort,
    arguments: process.argv
}));

const listOfClients = [];

// Start a websocket server and write the port to a file
const wss = new ws.Server({ port: randomWebsocketPort });


wss.on('connection', (ws) => {
    listOfClients.push(ws);
    let child = null;
    ws.send(JSON.stringify({
        type: 'connected',
        status: child ? 'running' : 'stopped'
    }))
    ws.on('message', (message) => {
        console.log('received: %s', message.toString());
        try {
            const msgdata = JSON.parse(message);
            if (msgdata.command == "exit") {
                try {
                    if (child) {
                        child.stdin.pause();
                        child.kill();
                    }
                }
                catch(e) {

                }
                process.exit(0);
            }
            else if (msgdata.command == "start") {
                if (!child) {
                    const current_args = process.argv.slice(2);
                    child = exec(current_args.join(" "), {
                        stdio: "pipe"
                    })

                    child.stdout.on('data', (data) => {
                        listOfClients.forEach(client => {
                            client.send(JSON.stringify({
                                type: 'stdout',
                                data: data.toString()
                            }));
                        });
                    });
                    child.stderr.on('data', (data) => {
                        listOfClients.forEach(client => {
                            client.send(JSON.stringify({
                                type: 'stderr',
                                data: data.toString()
                            }));
                        });
                    });
                    child.on('close', (code) => {
                        try {
                            listOfClients.forEach(client => {
                                client.send(JSON.stringify({
                                    type: 'close',
                                    data: code
                                }));
                            });
                        }
                        catch(e) {

                        }
                        console.log(`child process exited with code ${code}`);
                        process.exit(0);
                    });
                }


            }
        }
        catch(e) {}
    });
    ws.on('close', () => {
        console.log('Client disconnected');
        listOfClients.splice(listOfClients.indexOf(ws), 1);
    });
});

wss.on('close', () => {
    console.log('Websocket server closed');
});


